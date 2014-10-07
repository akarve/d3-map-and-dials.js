//TODO minify SVG 
//TODO eliminate d3.json and store data-bound SVG
//TODO remove console calls in production
d3.xml('img/us-map.svg', 'image/svg+xml', function(error, doc){
  console.assert(!error);
  document.getElementById('content')
    .appendChild(doc.getElementsByTagName('svg')[0]);
  d3.json('build/us.json', init); 
});

var svg;
var states;
var nodes; 
var scales = d3.map();
var last_state; 
var path = d3.geo.path().projection(null); 
var axes = {'duration':{'x':'x_duration', 'y':'y_politic', 'y_label':'political lean'}, 'politic':{'x':'x_politic', 'y':'y_income', 'y_label':'income gap'}, 'income':{'x':'x_income', 'y':'y_duration', 'y_label': 'sex duration'}};
var sim = {'init':false, 'last':'state', 'width':860, 'height':560};
var margin = {'top':90, 'right':40, 'bottom':60, 'left':90};
var size = {'stroke':2, 'legend_scale':0.32, 'x_shift':30, 'y_shift':80, 'flash':100};
var force;

function
init(error, us){
  console.assert(!error);
  sim.width -= (margin.left + margin.right);
  sim.height -= (margin.top + margin.bottom);
  nodes = topojson.feature(us, us.objects.states).features;
  nodes.forEach(typeAndHash);
  svg = d3.select('svg#us');
  svg.select('g#map')
    .append('g')
    .attr('id', 'states')
    .selectAll('g')
    .data(nodes)
    .enter()
    .append('g')
    .attr('id', function(d){ return d.properties.state; })
    .attr('class', 'state')
    .append('path')
    .attr('d', path)
    .attr('class', 'land');
  states = svg.selectAll('g.state');
  force = d3.layout.force()
    .nodes(nodes)
    .size([sim.width, sim.height])
    .gravity(.06)
    .charge(-135)
    .on('tick', tick)
  display();
}

function
display(){
  init_scales();
  states.each(function(d){ process_datum(d, this); });
  init_states();
  init_legend();
  init_axes();
  //53 = FIPS code for WA
  last_state = find(nodes, function(e){ return e.id === '53'; });
  //initialize button state
  nav_on('map');
  enter_states(last_state, true);
  //HANDLERS
  states.on('mouseenter', function(d){ enter_states(d, false); });
  states.on('click', function(d){ enter_states(d, false); });
  // nav buttons
  d3.select('#nav .button.map').on('click', function(){nav_on('map');});
  d3.select('#nav .button.chart').on('click', function(){nav_on('chart');});
  // axis buttons
  d3.select('.duration.button').on('click', function(){mode_on('duration');});
  d3.select('.politic.button').on('click', function(){mode_on('politic');});
  d3.select('.income.button').on('click', function(){mode_on('income');});
  //bring the house lights up
  svg.transition().style('opacity', 1);
  /* TODO serialization and remove this code
  var my_svg = new XMLSerializer().serializeToString(document.getElementsByTagName('svg')[0]);
  console.log(my_svg);
  */
}

function
nav_on(clss){
  d3.selectAll('#nav .button').classed('active', function(d){
    return this.classList.contains(clss);
  });
  d3.selectAll('.toggle-vis')
    .transition()
    .style('opacity', function(){ return clss === 'map' ? 0 : 1; })
    .style('visibility', function(){return clss === 'map' ?'hidden':'visible';});
  //d3.select('.state.button').on('click', function(){mode_on('state');});
  //TODO handle all cases, this only works for 2-state nav
  if(clss === 'map')
    mode_on('state');
  else
    mode_on('duration');
}

function
end(){
  return;
  /* TODO use this code to serialize a databound SVG for optimum perf/network 
  console.log(sim.last + ' sim ended');
  states
    .attr('data-x-' + sim.last, function(d){ return d.x; })
    .attr('data-y-' + sim.last, function(d){ return d.y; });
  */
}

function
tick(e){
  var decay = e.alpha/10.;
  nodes.forEach(function(d){
    //if(d.properties.state === 'DC')
      //console.log(d.y + ':' + d[axes[sim.last]['y']]);
    d.y += (d[axes[sim.last]['y']] - d.y)*decay;
    d.x += (d[axes[sim.last]['x']] - d.x)*decay;
  });
  if(sim.init){
    states.selectAll('path.land').attr('stroke-width', function(d){
      //diff stroke scale per state since they're under diff scale xforms
      return size.stroke/view_scale(d.width, d.height);
    });
    sim.init = false;
  }
  states.attr('transform', function(d){
    var s = view_scale(d.width, d.height);
    //translate it such that scale(s) will place object at origin 
    var trans = 'translate' + wrap(-d.x_centroid*s, -d.y_centroid*s);
    var scale = 'scale' + wrap(s);
    //translate again to d.x, adjust for scale
    var trans_ = 'translate' + wrap((d.x + margin.left)/s, (d.y + margin.top)/s);
    return [trans, scale, trans_].join(' ');
  });

  function
  view_scale(x, y){
    return 40 / Math.max(x,y);
  };
}

function
init_legend(){
  //add arc paths to legend dials
  var legend = svg.select('#legend');
  legend.selectAll('.dial path.arm').attr('d', arc());
  //add arrow decorators to politic dial
  var pol = legend.select('#dials #politic');
  pol.insert('path', ':first-child')
    .attr('class', 'lean')
    .attr('d', svg.select('#glyphs g.DC path.lean').attr('d'))
    .attr('transform', 'translate' + wrap(-30, 170) + ' scale' + wrap(1/size.legend_scale));
  pol.insert('path', ':first-child')
    .attr('class', 'lean')
    .attr('d', svg.select('#glyphs g.UT path.lean').attr('d'))
    .attr('transform', 'translate' + wrap(187, 40) + ' scale' + wrap(1/size.legend_scale));
  //decorators for income dial
  var inc_range = scales.get('income').range();
  var circs = legend.select('#dials #income')
    .insert('g', ':first-child')
    .attr('id', 'glyphs')
    .attr('transform', 'scale' + wrap(1/.32));
  income_circle(circs, 101, 55, 1);
  income_circle(circs, -25, 55, 7);
}

function
init_states(){
  //TOOD use HCL space
  //color in the states
  states.selectAll('path.land')
    .attr('stroke-width', size.stroke)
    .attr('fill', function(d){
      return scales.get('duration')(d.properties.duration);
    });
  svg.select('g#map')
    .append('g')
    .attr('id', 'glyphs')
    .selectAll('g')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', function(d){
      return 'glyph ' + d.properties.state;
    })
    .call(glyphs);
  function glyphs(sel){
    //political lean
    sel.append('path')
      .attr('class', 'lean')
      .attr('d', function(d){ return arrow_path(d); })
      .attr('transform', function(d){
        //radius of outer circle +1 for stroke-width
        var offset = scales.get('income').range()[1] + 1.5;
        //1.5 magic to offset arrow from circle
        var reverse = d.properties.politic < 0? 1:-1;
        return 'translate' + wrap(offset*reverse + d.x_centroid, d.y_centroid);
      });
    //income gap
    income_circle(sel);
  }
  states.insert('circle', ':first-child')
    .attr('class', 'mat')
    .attr('cx', function(d){ return d.x_center; })
    .attr('cy', function(d){ return d.y_center; })
    .attr('r',  function(d){ return d.radius; })
    .attr('opacity', 0);
  states.append('title').text(function(d){ return d.properties.state_longer; });
}

function
income_circle(sel, cx, cy, r){
  sel.append('circle')
    .attr('class', 'outer')
    .attr('cx', function(d){ return cx || d.x_centroid; })
    .attr('cy', function(d){ return cy || d.y_centroid; })
    .attr('r', 9);
  sel.append('circle')
    .attr('class', 'inner')
    .attr('cx', function(d){ return cx || d.x_centroid; })
    .attr('cy', function(d){ return cy || d.y_centroid; })
    .attr('r',  function(d){ return r || scales.get('income')(d.properties.income); });
}

function
init_axes(){
  var gaxes = svg.select('g#states').insert('g', ':first-child')
    .attr('id', 'axes')
    .attr('width', sim.width)
    .attr('height', sim.height);
  //POLITIC
  var scl = scales.get('x_politic');
  var x_axis = d3.svg.axis()
    .scale(scl)
    .innerTickSize(-(sim.height + margin.top + margin.bottom))
    .tickFormat(format_politic)
    .orient('top');
  gaxes.append('g')
    .attr('class', 'axis x_politic')
    .attr('opacity', 0)
    .attr('transform', function(){
      return 'translate' + wrap(margin.left, size.x_shift);
    })
    .call(x_axis);
  scl = scales.get('y_income');
  var y_axis = d3.svg.axis()
    .scale(scl)
    .innerTickSize(-(sim.width + margin.left))
    .tickFormat(format_income)
    .orient('left');
  gaxes.append('g')
    .attr('class', 'axis y_income')
    .attr('opacity', 0)
    .attr('transform', function(){
      return 'translate' + wrap(size.y_shift, margin.top);
    })
    .call(y_axis);
  //DURATION
  scl = scales.get('x_duration');
  x_axis = d3.svg.axis()
    .scale(scl)
    .innerTickSize(-(sim.height + margin.top + margin.bottom))
    .tickFormat(format_duration)
    .orient('top');
  gaxes.append('g')
    .attr('class', 'axis x_duration')
    .attr('opacity', 0)
    .attr('transform', function(){
      return 'translate' + wrap(margin.left, size.x_shift);
    })
    .call(x_axis);
  scl = scales.get('y_politic');
  y_axis = d3.svg.axis()
    .scale(scl)
    .innerTickSize(-(sim.width + margin.left))
    .tickFormat(format_politic)
    .orient('left');
  gaxes.append('g')
    .attr('class', 'axis y_politic')
    .attr('opacity', 0)
    .attr('transform', function(){
      return 'translate' + wrap(size.y_shift, margin.top);
    })
    .call(y_axis);
  //INCOME
  scl = scales.get('x_income');
  x_axis = d3.svg.axis()
    .scale(scl)
    .innerTickSize(-(sim.height + margin.top + margin.bottom))
    .tickFormat(format_income)
    .orient('top');
  gaxes.append('g')
    .attr('class', 'axis x_income')
    .attr('opacity', 0)
    .attr('transform', function(){
      return 'translate' + wrap(margin.left, size.x_shift);
    })
    .call(x_axis);
  scl = scales.get('y_duration');
  y_axis = d3.svg.axis()
    .scale(scl)
    .tickFormat(format_duration)
    .innerTickSize(-(sim.width + margin.left))
    .orient('left');
  gaxes.append('g')
    .attr('class', 'axis y_duration')
    .attr('opacity', 0)
    .attr('transform', function(){
      return 'translate' + wrap(size.y_shift, margin.top);
    })
    .call(y_axis);
  //format functions
  function format_politic(d){
    var rep = d < 0;
    switch(d){
      case 70:
        return '70% Dem.'
      case -20:
        //change sign since it's negative
        return '20% Rep.';
      case 0:
        return 'Neutral';
      default:
        return Math.abs(d) + '%';
    }
  }
  function format_income(d){
    var num = 100 - d;
    return num + '%';
  }
  function format_duration(d){
    return sec_to_min(d);
  }
  //only minor ticks
  gaxes.selectAll('g.tick').classed('minor', true);
}

function
enter_states(state, flag){
  if(!flag && last_state.properties.state === state.properties.state)
    return;
  svg.select('.state#' + last_state.properties.state)
    .classed('accent', false);
  svg.select('.state#' + state.properties.state)
    .classed('accent', true);
  last_state = state;
  update_dials(state);
  var e = svg.select('#states g#' + state.properties.state)[0][0];
  if(e) e.parentNode.appendChild(e);
}

function
mode_on(name){
  activate_button(name); //turn the button on
  sim.last = name; //global sim data
  //all axes off
  svg.selectAll('g.axis').transition().attr('opacity', 0);
  states.selectAll('circle.mat').transition().attr('opacity',0);
  //y axis label off
  svg.select('#map .y.label text').transition().attr('opacity', 0);
  //set display:none so mats don't interfere with hit testing on states
  states.selectAll('circle.mat').transition().delay(250).attr('display', 'none');
  if(name !== 'state'){
    sim.init = true;
    force.start(); //TODO: force.resume instead so sim can rest once done?
    var xax = axes[name]['x'];
    var yax = axes[name]['y'];
    //axes on
    svg.select('g.axis.' + yax).transition().attr('opacity', 1);
    svg.select('g.axis.' + xax).transition().attr('opacity', 1);
    //y label on
    svg.select('#map .y.label text').transition().attr('opacity', 1);
    svg.select('#map .y.label text').text(axes[name]['y_label']);
    //mats on
    states.selectAll('circle.mat').attr('display', 'inline');
    states.selectAll('circle.mat').transition().attr('opacity', 1);
    //glyphs off
    svg.select('g#glyphs').transition().attr('opacity', 0);
    //svg.selectAll('g.glyph').attr('opacity', 0);
  }else{
    svg.selectAll('#legend .label.axis').attr('opacity',0);
    force.stop();
    //restore land,glphs to orignal positions
    states.transition().duration(750).attr('transform', '');
    //glpyhs on
    svg.select('g#glyphs').transition().attr('opacity', 1);
    //svg.selectAll('g.glyph').transition().delay(750).attr('opacity', 1);
    //restore pre-transform stroke-width
    states.selectAll('path.land').transition().attr('stroke-width', size.stroke);
  }
}

function
activate_button(bclass){
  //state button managed by nav_on()
  if(bclass === 'state'){
    return;
  }
  //get the sex/politics/pay_gap radio and turn only bclass on
  d3.selectAll('.button-group.x-axis a')
    .classed('active', function(){
      return this.classList.contains(bclass);
    });
}

function
update_dial(name, state, angle){
  var dial = '#' + name + '.dial';
  var field = name + '_long';
  var legend = svg.select('#legend');
  legend.select(dial + ' tspan.accent')
    .transition()
    .duration(size.flash)
    .attr('opacity', 0.7)
    .transition()
    .duration(size.flash)
    .attr('opacity', 1)
    .text(state['properties'][field]);
  if(name === 'politic')
    legend.select(dial + ' tspan.detail')
      .text(pol_party(state.properties.politic));
  if(angle !== null)
    legend.select(dial + ' path.arm')
      .transition()
      .duration(300)
      .attr('transform', 'rotate(' + angle + ', 0, 0)')
      .ease('out');
  function
  pol_party(lean){
    var x = Math.round(lean);
    if(x > 0)
      return 'Democrat';
    else if(x === 0)
      return 'Neutral';
    else
      return 'Republican';
  }
}

//swing dials from let to right, TODO use symm() function
var _dial_angle = d3.scale.linear().range([-90, 90]);
function
update_dials(state){
  update_dial('state', state, null);
  _dial_angle.domain(scales.get('duration').domain());
  update_dial('duration', state, dial_angle('duration', state.properties.duration));
  //political lean dial; reverse b/c republican (negative) should lean right
  //OPTIM - don't copy & reverse every time
  _dial_angle.domain(scales.get('politic').domain().slice().reverse()); 
  //take complement of dial_angle so dem is left and repub is right
  update_dial('politic', state, -dial_angle('politic', state.properties.politic));
  _dial_angle.domain(scales.get('income').domain()); 
  update_dial('income', state, -dial_angle('income', state.properties.income));

  function
  dial_angle(name, value){
    _dial_angle.domain(scales.get(name).domain());
    return _dial_angle(value);
  }
}

function
process_datum(d, e){
  var box = e.getBBox();
  d.x = box.x;
  d.y = box.y;
  ctd = path.centroid(d);
  d.x_centroid = ctd[0];
  d.y_centroid = ctd[1];
  d.x_center = d.x + box.width/2;
  d.y_center = d.y + box.height/2;
  d.width = box.width;
  d.height = box.height;
  d.radius = Math.sqrt(Math.pow(d.x_center - d.x, 2) + Math.pow(d.y_center - d.y, 2));
  //init all of the simulation destinations
  var dims = ['x', 'y'];
  for(var prop in axes){
    for(var i = 0; i < dims.length; i++){
      var axis = axes[prop][dims[i]];
      if(typeof d[axis] === 'undefined'){
        //get axis property as first capture group
        var aprop = axis.match(/._(.+)/)[1];
        d[axis] = scales.get(axis)(d['properties'][aprop]);
      }
    }
  }
}

function
init_scales(){
  var lightness = d3.scale.sqrt().range([.8, .4]);
  lightness.domain(d3.extent(nodes, function(d){ return d.properties.duration; }));
  var hue = d3.scale.sqrt().range([45, 5]);
  hue.domain(lightness.domain());
  var dur = function(x){
    return d3.hsl(hue(x), .8, lightness(x));
  };
  dur.domain = function(){ return hue.domain();};
  scales.set('duration', dur);
  var domain_pr = d3.extent(nodes, function(d){ return d.properties.politic; });
  //map right/left leanings to length of arrow
  scales.set('politic', d3.scale.pow(3)
    .domain(symm(domain_pr))
    .range([67, -67]));
  var gap_domain = d3.extent(nodes, function(d){ return d.properties.income; });
  //sqrt since mapped to circle area
  scales.set('income', d3.scale.sqrt()
    .domain(gap_domain)
    .range([1, 7]));
  scales.set('x_politic', d3.scale.linear()
    .domain(domain_pr)
    //reverse range so republican (negative politic) is on right
    .range([sim.width, 0]));
 scales.set('y_politic', d3.scale.linear()
    .domain(domain_pr)
    //reverse range so republican (negative politic) is on right
    .range([sim.height, 0]));
 scales.set('x_income', d3.scale.linear()
    .domain(gap_domain)
    //higher numbers are smaller gap so send give them large y (lower)
    .range([0, sim.width]));
 scales.set('y_income', d3.scale.linear()
    .domain(gap_domain)
    //higher numbers are smaller gap so send give them large y (lower)
    .range([0, sim.height]));
  scales.set('x_duration', d3.scale.linear()
    .domain(lightness.domain())
    .range([0, sim.width]));
  scales.set('y_duration', d3.scale.linear()
    .domain(lightness.domain())
    .range([sim.height, 0]));
}

function
arrow_path(d){
  var length = Math.abs(scales.get('politic')(d.properties.politic)) ;
  if(length < 0.5)
    return 'm0 0'; //can't return '', error console doesn't like d=''
  var width = 4;
  var arm_l = width/1;
  var reverse = d.properties.politic <= 0 ? 1 : -1;
  var head_l = 8*reverse;
  var body = (length)*reverse;
  var tail1 = ' v' + -width/2;
  var shldr1 = ' h' + body;
  var arm1 = ' v' +  -arm_l;
  var head = ' l' + head_l + ' ' + (width/2 + arm_l);
  var arm2 = ' l' + -head_l + ' ' + (width/2 + arm_l);
  var shldr2 = ' v' + -arm_l;
  var tail2 = ' h' + -body;
  var path =  'm0 0' + tail1 + shldr1 + arm1 + head + arm2 + shldr2
    + tail2 + ' z';
  return path;
}

function
typeAndHash(d){
  d.properties.state_longer = d.properties.state_long;
  //_long is what actually gets displayed in the dial UI
  d.properties.duration_long = sec_to_min(d.properties.duration);
  d.properties.income_long = Math.round(100 - d.properties.income) + '%';
  d.properties.politic_long = Math.abs(Math.round(d.properties.politic)) + '%';  
  d.properties.state_long = d.properties.state;
  return d;
}

function
sec_to_min(s){
  var min = Math.floor(s/60);
  var sec = s - 60*min;
  sec = sec < 10 ? '0' + sec : sec;
  return min + ':' + sec;
}
