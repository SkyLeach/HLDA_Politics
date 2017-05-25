// ==UserScript==
// @name        RedditAnalyze
// @namespace   redalyze
// @description Analyze A Discussion
// @include     https://www.reddit.com/*
// @include     /^https?//www\.reddit\.com/.*/comments/.*$/
// @version     0.1
// @grant       GM_addStyle
// @require https://code.jquery.com/jquery-3.2.1.slim.min.js
// @require https://unpkg.com/compromise@latest/builds/compromise.min.js
// @require https://d3js.org/d3.v4.min.js
// ==/UserScript==
/*jshint esversion: 6 */

// globals for functional reuse
var data = {
  comments  : {},
  topics    : {},
  nouns     : {},
  max_depth : 0
};
var worker = null;
$(document).ready(function() {
  //create the dialogue
  $("body").append ( `
      <div id="gmPopupContainer">
      <form> <!-- For true form use method="POST" action="YOUR_DESIRED_URL" -->
          <label for="target_pronoun">Pronoun Target</label>
          <input type="text" id="target_pronoun" value="">

          <p id="display_target_pronoun">&nbsp;</p>
          <button id="gmBuildDataBtn" type="button">Build Data</button>
          <button id="gmBuildTopicBarChartBtn" type="button">Build Topic Barchart</button>
          <button id="gmCloseDlgBtn" type="button">Close popup</button>
      </form>
      <svg id="coreViz" class="cv_barchart"></svg>
      <pre id="gmCSV" class="csv_selector"></pre>
      </div>
      <script id="worker1" type="javascript/worker">
        // This script won't be parsed by JS engines because its type is javascript/worker.
        self.onmessage = function(e) {
          self.postMessage('msg from worker');
        };
        // Rest of your worker code goes here.
      </script>
  ` );
  var blob = new Blob([
    document.querySelector('#worker1').textContent
  ], { type: "text/javascript" });

  // Note: window.webkitURL.createObjectURL() in Chrome 10+.
  worker = new Worker(window.URL.createObjectURL(blob));
  worker.onmessage = function(e) {
    console.log("Received: " + e.data);
  };
  worker.postMessage("hello"); // Start the worker.

  $("#gmBuildTopicBarChartBtn").click(function () {
    build_data();
    container = '#gmPopupContainer';
    //$(container).toggleClass('gmExpanded', false);
    $(container).height($(window).height()*0.8);
    var entrydata = d3.entries(data.topics).sort(getSortCallback(d3.ascending, 'count'));
    /*
    var depthmatrix = function() {
      result = [];
      try {
        for (let i in entrydata) {
          var key = entrydata[i].key;
            obj = entrydata[i].value;
          for (let di=1;di<=data.max_depth;di++) {
            result.push([di, (di in obj.depth_count) ? obj.depth_count[di] : 0, obj]);
          }
        }
        return result;
      } catch (err) {
        console.log(err.stack);
      }
    }();
    console.log(depthmatrix);
    */
    //TODO: calculate real pointsize
    //var pointsize = parseInt($(container).css('font-size')) * 72/96;
    var chartwidth = $(container).width() - 20; //20 is estimated 2em at 10px fontsize
    var barHeight = 20;
    var scale = d3.scaleLinear()
      .domain([0, entrydata[entrydata.length-1].value.count])
      .range([0, chartwidth]);
    var color_scale = d3.scaleLinear()
      .domain([entrydata[entrydata.length-1].value.count,0])
      .range([255, 100]);
    var chart = d3.select('#coreViz')
      .attr("width", chartwidth)
      .attr("height", barHeight * entrydata.length);
    var bar = chart.selectAll('g')
      .data(entrydata)
      .enter().append("g")
        .attr("transform", function(d, i) { return "translate(0," + i * barHeight + ")"; });
    function func_scalewidth(depth, obj) {
      return function(d, i) {return scale(obj.depth_count[depth]); };
    }
    function func_translate(offset) {
      return function(d, i) { return "translate(" + offset + ",0)"; };
    }
    function get_offset(maxdepth,objkey) {
      let offset = 0;
      for (let depth in data.topics[objkey].depth_count) {
        if(depth >= maxdepth) return offset;
        offset+=scale(data.topics[objkey].depth_count[depth]);
      }
      return offset;
    }
    var rect = bar.selectAll('rect')
      .data(function(d){
        let result = d3.entries(d.value.depth_count);
        for(let i in result){ result[i].value = [result[i].value, d.key]; }
        return result;})
      .enter().append('rect')
        .attr("transform", function(d, i) {
          return "translate(" + get_offset(d.key,d.value[1]) + ",0)";
        })
        .attr("width", function(d, i) { return scale(d.value[0]); })
        .attr("height", barHeight - 1)
        .attr("style", function(d, i) { return "fill:rgb(0,0," + color_scale(d.key) +")"; });
    /*
    bar.each(function(d,i) {
      obj = d.value;
      let offset = 0;
      for (let depth in obj.depth_count) {
        bar.append('rect')
          .attr("transform", func_translate(offset))
          .attr("width", func_scalewidth(depth, obj))
          .attr("height", barHeight - 1)
          .attr("style", "fill:rgb(0,0," + color_scale(offset) +")");
        offset+=scale(obj.depth_count[depth]);
      }
    });
    */
    bar.append("text")
      .attr("x", function(d) { return scale(d.value.count) - 3; })
      .attr("y", barHeight / 2)
      .attr("dy", ".35em")
      .text(function(d) { return d.key + ':' + d.value.count; });
  });

  $("#gmBuildDataBtn").click(function () {
    build_data(true);
  });

  $("#copyCSVText").click( function () {
      let selector = 'gmCSV';
      $('#'+selector).show();
      $('#'+selector).text(topicsToCSV(data.topics));
      select_copy_clear(document.getElementById(selector));
      $('#'+selector).hide();
  } );

  $("#gmCloseDlgBtn").click ( function () {
    $("#gmPopupContainer").hide ();
    //$('#gmPopupContainer').css({'width': '', 'height': ''});
    $('#gmPopupContainer').toggleClass('gmExpanded', false);
  } );

  //add analyze button
  $('ul.tabmenu').append(`
      <li>
        <a id="gmAnalyzeMenuItm" class="choice" href="#">Analyze Comments</a>

      </li>
  `);
  $('#gmAnalyzeMenuItm').click(function () { $('#gmPopupContainer').show(); });


  //--- CSS styles make it work...
  GM_addStyle ( `
    #gmPopupContainer {
      position                   : fixed;
      top                        : 10%;
      left                       : 10%;
      max-width                  : 75%;
      max-height                 : 80%;
      padding                    : 2em;
      background                 : powderblue;
      border                     : 3px double black;
      border-radius              : 1ex;
      z-index                    : 777;
      display                    : none;
      overflow                   : auto; /* Enable scroll if needed */
      box-shadow                 : 0 4px 8px 0 rgba(0,0,0,0.2),0 6px 20px 0 rgba(0,0,0,0.19);
      -webkit-animation-name     : animatetop;
      -webkit-animation-duration : 0.3s;
      animation-name             : animatetop;
      animation-duration         : 0.3s;
      -webkit-transition         : width 300ms ease-in-out, height 300ms ease-in-out;
      -moz-transition            : width 300ms ease-in-out, height 300ms ease-in-out;
      -o-transition              : width 300ms ease-in-out, height 300ms ease-in-out;
      transition                 : width 300ms ease-in-out, height 300ms ease-in-out;
    }

    /* Add 'expanded' size class */
    .gmExpanded {
      width    : 75%;
      height   : 80%;
    }

    /* Add Animation */
    @-webkit-keyframes animatetop {
      from { top: -100px ; opacity: 0}
      to   { top: 10%    ; opacity: 1}
    }

    @keyframes animatetop {
      from { top: -100px ; opacity: 0}
      to   { top: 10%    ; opacity: 1}
    }

    #gmPopupContainer button{
      cursor : pointer;
      margin : 1em 1em 0;
      border : 1px outset buttonface;
    }

    .csv_selector {
        display : none;
        width   : 1px;
        height  : 1px;
    }

    .cv_barchart rect {
      fill: steelblue;
    }

    .cv_barchart text {
      fill: white;
      font: 10px sans-serif;
      text-anchor: end;
    }
  `);
});

function selectMe(elem) {
  var text = null;
  if (typeof elem === 'object') {
    text = elem;
  } else {
    text = doc.getElementById(elem);
  }
  var doc = document, range, selection;
  if (doc.body.createTextRange) {
    range = document.body.createTextRange();
    range.moveToElementText(text);
    range.select();
  } else if (window.getSelection) {
    selection = window.getSelection();
    range = document.createRange();
    range.selectNodeContents(text);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function select_copy_clear(elem) {
  //TODO: add clear
  selectMe(elem);
  document.execCommand("copy");
}

function getSortCallback(sortcall, prop=null) {
  return function(a, b) {
    if(prop) {
      return sortcall(a.value[prop], b.value[prop]);
    } else {
      return sortcall(a.key, b.key);
    }
  };
}

function build_data(rebuild=false){
  if(!Object.keys(data.comments).length || rebuild){
    data.comments = get_nested_comment_dict();
    data.topics   = count_nlp_topics(data.comments);
    data.nouns    = count_nlp_nouns(data.comments);
    /*
    data.topic_keys = {
      pk    : Object.keys(data.topics),
      count : function(key=null){
        let result = [];
        if(!key) {
          key = Object.values(data.topics);
        }
        for(let d in key){
          if(depth in d.depth_count) {
            result.push(d.depth_count[depth]);
          }else{
            result.push(0);
          }
        }
        return result;
      },
      depth_count : function(depth, key=null) {
        let result = [];
        if(!key) {
          key = Object.values(data.topics);
        }
        for(let d in key){
          if(depth in d.depth_count) {
            result.push(d.depth_count[depth]);
          }else{
            result.push(0);
          }
        }
        return result;
      }
    };
    */
  }
}


function get_page_comments(depth=0) {
  return $('.entry').find('.usertext-body').find('.md').find('p');
}
// Test at https://jsfiddle.net/019xypLv/3/
function get_t1Things(parent){
  return parent.children('[id^=thing_t1_]');
}

function get_t1ThingByHash(hash){
  return $('#thing_t1_'+hash);
}

function get_siteTable(hash=null){
  if (hash === null){
    return $('div.commentarea').children('[id^=siteTable_t3_]');
  }else{
    return $('#siteTable_t1_'+hash);
  }
}

function get_thingAuthor(thing) {
  return thing.children('div.entry').
               children('p.tagline').
               children('a.author').text();
}

function get_thingParagraphs(thing) {
  return thing.children('div.entry').
               children('form.usertext').
               children('div.md-container').
               children('div.md').find('p');
}

function topicsToCSV(obj) {
  var csv = '';
  try {
    $.each(obj, function(k, v) {
      if(csv === '') {
        csv += '"Topic","Count",';
        for (let i=1;i<20;i++) {
          csv += ',"DC ' + i + '"';
        }
        csv += '"Sources"';
        csv += '\n';
      }
      csv +=  '"' + k + '"' + ',' +
              v.count + ',';
      for (let i=1; i<20; i++) {
        csv+= (i in v.depth_count) ? v.depth_count[i] + ',' : '0' + ',';
      }
      csv += '"' + v.sources.join() + '"';
      csv += '\n';
    });
  } catch (err) {
    console.log(err.stack);
  }
  return csv;
}

function clean_text(elem) {
  //attempts to clean out child elements:
  clone = $(elem).clone();
  // <em></em>
  clone.children('em').replaceWith(function() { return $(this).text(); });
  // <strong></strong>
  clone.children('strong').replaceWith(function() { return $(this).text(); });
  // <a>...?</a> -> to inner text or LINK (for now)
  // TODO: better link handling
  clone.children('a').replaceWith(function() {
    text = $(this).text();
    if (!text || text == $(this).attr('href')) {
      text = 'LINK';
    }
    return text;
  });
  return clone.text();
  // TODO: strikethrough handling

}

function paragraphsToNLP(paragraphs) {
  //TODO: cleanup strikethrough
  nlstring = '';
  paragraphs.each(function (ndex, pelem) {
    if (nlstring !== ''){
      nlstring += '\n\n' + clean_text(pelem);
    }else{
      nlstring = clean_text(pelem);
    }
  });
  try {
    return nlp(nlstring);
  } catch (err) {
    console.log('Error parsing string:');
    console.log(nlstring);
    console.log(err.stack);
    return null;
  }
}

function getCommentHash(thing) {
  //get the hash for this thing
  return thing.children('p.parent').children('a').attr('name');
}

function getThingChildren(thing) {
  //return an array of children things
}

function traverse_and_add_children(collection_dict, parent_hash, depth) {
  children = get_t1Things(get_siteTable(parent_hash));
  children.each(function(ndex, el){
    child = $(el);
    hash = getCommentHash(child);
    if (typeof hash == 'undefined'){
      return;
    } else if (typeof collection_dict[parent_hash].children == 'undefined'){
      collection_dict[parent_hash].children = [hash];
    } else {
      collection_dict[parent_hash].children.push(hash);
    }
    collection_dict[hash] = {
      thing  : child,
      parent : parent_hash,
      depth  : depth,
      author : get_thingAuthor(child)
    };
    traverse_and_add_children(collection_dict, hash, depth+1);
  });
}

function get_nested_comment_dict() {
  //load all the comments in a flat dictionary with references to parents and
  //children by hash.
  var result = {}; //dict result
  //top-level comment things
  tlthings = get_t1Things(get_siteTable());
  tlthings.each(function(ndex, el) {
    thing = $(el);
    hash = getCommentHash(thing);
    if (typeof hash != 'undefined'){
      result[hash] = {
        thing : thing,
        depth : 1,
        author : get_thingAuthor(thing)
      };
      traverse_and_add_children(result, hash, 2);
    }
  });
  return result;
}

function* nlp_comment_iter(){
  //generator to return an nlp object for each comment paragraph
  comments = get_page_comments();
  for (var cp in comments){
    yield nlp(comments[cp]);
  }
}

function count_nlp_topics(comment_things) {
  result = {};
  $.each(comment_things, function (k, v) {
    try {
      nlparsed = paragraphsToNLP(get_thingParagraphs($(v.thing)));
      if (!nlparsed){return;}
      topics = nlparsed.topics().out('json');
      if(topics.length > 0) {
        for (var topic in topics){
          if(data.max_depth < v.depth) data.max_depth = v.depth;
          topic = topics[topic][0].normal;
          if(topic in result){
            result[topic].count++;
            result[topic].sources.push(k);
            if (v.depth in result[topic].depth_count) {
              result[topic].depth_count[v.depth]++;
            }else{
              result[topic].depth_count[v.depth] = 1;
            }
          }else{
            result[topic] = {};
            result[topic].count = 1;
            result[topic].depth_count = {};
            result[topic].depth_count[v.depth] = 1;
            result[topic].sources=[k];
          }
        }
      }
    } catch (err) {
      console.log(err.stack);
    }
  });
  return result;
}
function count_nlp_nouns(comment_things) {
  result = {};
  $.each(comment_things, function (k, v) {
    nlparsed = paragraphsToNLP(get_thingParagraphs($(v.thing)));
    if(!nlparsed) return;
    people = nlparsed.people().out('json');
    if (people.length > 0){
      for (var person in people){
        person = people[person][0].normal;
        if(person in result){
          result[person].count++;
          if (v.depth in result[person].depth_count) {
            result[person].depth_count[v.depth]++;
          }else{
            result[person].depth_count[v.depth] = 1;
          }
        }else{
          result[person] = {};
          result[person].count = 1;
          result[person].depth_count = {};
          result[person].depth_count[v.depth] = 1;
        }
      }
    }
    nouns = nlparsed.nouns().out('json');
    if(nouns.length > 0) {
      for (var noun in nouns){
        noun = nouns[noun][0].normal;
        if(noun in result){
          result[noun].count++;
          if (v.depth in result[noun].depth_count) {
            result[noun].depth_count[v.depth]++;
          }else{
            result[noun].depth_count[v.depth] = 1;
          }
        }else{
          result[noun] = {};
          result[noun].count = 1;
          result[noun].depth_count = {};
          result[noun].depth_count[v.depth] = 1;
        }
      }
    }
  });
  return result;
}

function trigger_morecomments_by_hash(hash) {
  $('#more_t1_'+hash).trigger('click');
}