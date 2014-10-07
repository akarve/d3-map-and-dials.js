// symmetrical bounds for an extent
function
symm(extent){
  if(extent == null || extent.length !== 2){
    throw new Error("invalid extent for data"); 
  }else{
    var max = Math.max(Math.abs(extent[0]), Math.abs(extent[1]));
    return [-max, max];
  }
}

function
scaleAt(s, x, y){
  var s2 = s - 1;
  var trans = "translate" + wrap(-x*s2, -y*s2);
  var scale = "scale" + wrap(s);
  return trans + " " + scale;
}

//todo remove this and related code in display()
function
triangle_path(d){
  var base = 15;//Math.max(d.width, d.height)/5;
  var height = 1.5*base;
  var x_left = d.x_center - base/2;
  var x_right = x_left + base;
  var x_top = d.x_center;
  var y_left = d.y_center + height/2
  var y_right = y_left;
  var y_top = d.y_center - height/2;
  var s = "M" + x_left + " " + y_left + " L" + x_right + " " + y_right
    + " L" + x_top + " " + y_top + " Z";
  return s;
}

function
find(arr, pred){
  for(var i = 0; i < arr.length; i++){
    elt = arr[i];
    if(pred(elt))
      return elt;
  }
  return null;
}

// draw circle arc for use as dial needle
function
arc(){
  var sweep = Math.PI*10/180;
  return d3.svg.arc()
    .innerRadius(120)
    .outerRadius(160)
    .startAngle(-sweep)
    .endAngle(sweep);
}
//PRE group is d3.quantize() scale
//PRE nodes is sorted as desired
function
tile_group(nodes, key, dim){
  console.assert(none_null(arguments));
  var rows = 1; var cols = 4; var groups = {};
  d3.range(rows*cols).forEach(function(g){ groups[g] = [];}); 
  nodes.forEach(function(e, i){
    var stride = Math.ceil(nodes.length / Object.keys(groups).length);
    groups[Math.floor(i/stride)].push(e);
  });
  var wid = 1.22*dim[0]/cols; var hgt = 2.6*dim[1]/rows; //magic weights -_-
  for(var g in groups)
    tile(groups[g], wid, hgt); 
  for(var g in groups)
    groups[g] = {nodes: groups[g], size: size(groups[g])};
  var keys = Object.keys(groups);
  var dims = keys.map(function(k){ return groups[k].size; });
  var w_max = dims.reduce(function(a, b){ return a[0] > b[0] ?  a:b; })[0];
  var h_max = dims.reduce(function(a, b){ return a[1] > b[1] ?  a:b; })[1];
  for(var g in groups){
    var row = Math.floor(g/cols); var col = g % cols;
    var nodes = groups[g].nodes;
    for(var i = 0; i < nodes.length; i++){
      nodes[i].x_layout += col * w_max;
      nodes[i].y_layout += row * h_max;
    }
  }
}

function
size(nodes){
  var x_vals = nodes.map(function(n){
    return n.x_layout;
  });
  var y_vals = nodes.map(function(n){
    return n.y_layout;
  });
  return [x_vals.reduce(_max), y_vals.reduce(_max)];
}
//PRE nodes in sorted order
function
tile(nodes, width, height){
  console.assert(width > 0 && height > 0);
  console.assert(nodes != null && nodes.length > 0);
  //init tree pointers
  nodes.forEach(function(d, i, arr){
    //use .dad since .parent reserved
    d.left = d.right = d.dad = null;
    d.x_layout = d.y_layout = null;
  });
  var root = nodes[0];
  //place root upper left
  root.x_layout = root.width;
  root.y_layout = root.height;

  for(var i = 1; i < nodes.length; i++)
    if(! insert(nodes[i], root))
      console.log("could not insert: " + nodes[i].state);

  return nodes;

  function insert(i, root){
    var success = false;
    in_order(root);
    return success;
    //reverse in-order traversal of binary tree : RIGHT ROOT LEFT
    function in_order(node){
      if(node === null){
        return;
      }else{
        //recursion can return to this block & clobber success === true
        //OPTIM might not need this first one
        if(! success)
          in_order(node.right);
        if(! success)
          success = _append(i, node);
        if(! success)
          in_order(node.left);
      }
    }
  }

  //append as child, if possible
  //RETURN true iff append successful
  function _append(node, root){
    //could it fit as a right child? (to the right in 2D)
    if((root.right === null) && (node.height <= root.height) && (root.x_layout + node.width <= width)){
      node.x_layout = root.x_layout + node.width;
      node.y_layout = root.y_layout - root.height + node.height;
      node.dad = root;
      root.right = node;
      return true;
    //could it fit as a left child? (below in 2D)
    }else if(root.left === null){
      //if .dad === null we are at root of entire tree
      //check if x_layout > 0
      var dad_y = root.dad === null ? height : root.dad.y_layout;
      //are we to the right of something?
      var limit = (root.x_layout - root.width) > 0  ? dad_y : height;
      var fits = (root.y_layout + node.height) <= limit;
      if(fits){
        node.x_layout = root.x_layout - root.width + node.width;
        node.y_layout = root.y_layout + node.height;
        node.dad = root;
        root.left = node;
      }
      return fits;
    //does not fit left or right node
    }else{
      return false;
    }
  }
}

//UTILITY
function
none_null(){
  args = Array.prototype.slice.call(arguments, 0);
  console.assert(args.length > 0);
  var flags = args.map(function(x){ return !(x === null); });
  return flags.reduce(function(a,b){ return a && b; });
}

function _max(a, b){
  //cannot pass Math.max to reduce
  return Math.max(a, b);
}

//convenience function to prepare string arguments, e.g. for "translate(x y)"
function wrap(){
  var args = Array.prototype.slice.call(arguments);
  return "(" + args.join(" ") + ")";
}

// formulas from http://en.wikipedia.org/wiki/Circular_segment
function
percent_to_descent(p){
  p /= 100;
  console.assert(p >= .5 && p <= 1);
  var steps = 25;
  var stride = Math.PI/steps;
  var angles = [];
  for(var i = 0; i <= steps; i++)
    angles.push(i*stride);
  areas = angles.map(function(x){ return .5*(x - Math.sin(x)); });
  //assume unit circle, area of target segment
  var segment = (1-p)*Math.PI;
  var diffs = areas.map(function(x){ return Math.abs(segment - x); });
  var min = diffs.reduce(function(x,y){ return Math.min(x,y); });
  var i_min = diffs.indexOf(min);
  console.assert(i_min >= 0); //search must succeed
  var a_goal = angles[i_min];
  return 1 - Math.cos(a_goal/2.);
}

//http://phrogz.net/convert-svg-path-to-all-absolute-commands
function convertToAbsolute(path){
  var x0,y0,x1,y1,x2,y2,segs = path.pathSegList;
  for (var x=0,y=0,i=0,len=segs.numberOfItems;i<len;++i){
    var seg = segs.getItem(i), c=seg.pathSegTypeAsLetter;
    if (/[MLHVCSQTA]/.test(c)){
      if ('x' in seg) x=seg.x;
      if ('y' in seg) y=seg.y;
    }else{
      if ('x1' in seg) x1=x+seg.x1;
      if ('x2' in seg) x2=x+seg.x2;
      if ('y1' in seg) y1=y+seg.y1;
      if ('y2' in seg) y2=y+seg.y2;
      if ('x'  in seg) x += seg.x;
      if ('y'  in seg) y += seg.y;
      switch(c){
        case 'm': segs.replaceItem(path.createSVGPathSegMovetoAbs(x,y),i);                   break;
        case 'l': segs.replaceItem(path.createSVGPathSegLinetoAbs(x,y),i);                   break;
        case 'h': segs.replaceItem(path.createSVGPathSegLinetoHorizontalAbs(x),i);           break;
        case 'v': segs.replaceItem(path.createSVGPathSegLinetoVerticalAbs(y),i);             break;
        case 'c': segs.replaceItem(path.createSVGPathSegCurvetoCubicAbs(x,y,x1,y1,x2,y2),i); break;
        case 's': segs.replaceItem(path.createSVGPathSegCurvetoCubicSmoothAbs(x,y,x2,y2),i); break;
        case 'q': segs.replaceItem(path.createSVGPathSegCurvetoQuadraticAbs(x,y,x1,y1),i);   break;
        case 't': segs.replaceItem(path.createSVGPathSegCurvetoQuadraticSmoothAbs(x,y),i);   break;
        case 'a': segs.replaceItem(path.createSVGPathSegArcAbs(x,y,seg.r1,seg.r2,seg.angle,seg.largeArcFlag,seg.sweepFlag),i);   break;
        case 'z': case 'Z': x=x0; y=y0; break;
      }
    }
    if (c=='M' || c=='m') x0=x, y0=y;
  }
}

function
init_patterns(radius){
  var dmn = scales.get("income").domain();
  //round to fives
  var first = Math.round(dmn[0]);
  var last = Math.round(dmn[1]);
  for(var i = first; i <= last; i++){
    var d = percent_to_descent(i);
    svg.select("defs")
      .append("pattern")
      .attr("id", i + "-cfill")
      .attr("width", radius*2)
      .attr("height", radius*4)
      .attr("patternContentUnits", "userSpaceOnUse")
      //rect
      .append("rect")
      .classed("fill", true)
      .attr("x", 0)
      .attr("y", radius*d)
      .attr("width", radius*2)
      .attr("height", radius*2)
      //todo move call to style sheet
  }
}
