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
$(document).ready(function() {
  //create the dialogue
  $("body").append ( `
      <div id="gmPopupContainer">
      <form> <!-- For true form use method="POST" action="YOUR_DESIRED_URL" -->
          <label for="target_pronoun">Pronoun Target</label>
          <input type="text" id="target_pronoun" value="">

          <p id="display_target_pronoun">&nbsp;</p>
          <button id="countNounsBtn" type="button">Count the Nouns</button>
          <button id="gmCloseDlgBtn" type="button">Close popup</button>
      </form>
      </div>
  ` );

  //--- Use jQuery to activate the dialog buttons.
  $("#countNounsBtn").click(function () {
    //$('#gmPopupContainer').css({'width': '800px', 'height': '600px'});
    $('#gmPopupContainer').toggleClass('gmExpanded');
    comment_hashdict = get_nested_comment_dict();
    console.log(comment_hashdict);
    noundict = count_nlp_nouns(comment_hashdict);
    console.log(noundict);
  });
  /*$("#gmAddNumsBtn").click( function () {
      var target_pronoun   = $("#target_pronoun").val ();
      $("#display_target_pronoun").text ("Current Target Pronoun is: " + target_pronoun);
  } );*/
  $("#gmCloseDlgBtn").click ( function () {
    $("#gmPopupContainer").hide ();
    //$('#gmPopupContainer').css({'width': '', 'height': ''});
    $('#gmPopupContainer').toggleClass('gmExpanded');
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
      top                        : 30%;
      left                       : 20%;
      padding                    : 2em;
      background                 : powderblue;
      border                     : 3px double black;
      border-radius              : 1ex;
      z-index                    : 777;
      display                    : none;
      overflow                   : auto; /* Enable scroll if needed */
      box-shadow                 : 0 4px 8px 0 rgba(0,0,0,0.2),0 6px 20px 0 rgba(0,0,0,0.19);
      -webkit-animation-name     : animatetop;
      -webkit-animation-duration : 0.4s;
      animation-name             : animatetop;
      animation-duration         : 0.4s;
      -webkit-transition         : width 300ms ease-in-out, height 300ms ease-in-out;
      -moz-transition            : width 300ms ease-in-out, height 300ms ease-in-out;
      -o-transition              : width 300ms ease-in-out, height 300ms ease-in-out;
      transition                 : width 300ms ease-in-out, height 300ms ease-in-out;
    }

    /* Add 'expanded' size class */
    .gmExpanded {
      width    : 800px;
      height   : 300px;
      overflow : scroll;
    }

    /* Add Animation */
    @-webkit-keyframes animatetop {
      from { top: -300px ; opacity: 0}
      to   { top: 30%    ; opacity: 1}
    }

    @keyframes animatetop {
      from { top: -300px ; opacity: 0}
      to   { top: 30%    ; opacity: 1}
    }

    #gmPopupContainer button{
      cursor : pointer;
      margin : 1em 1em 0;
      border : 1px outset buttonface;
    }
  `);
});

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

function paragraphsToNLP(paragraphs) {
  //TODO: cleanup strikethrough
  //TODO: cleanup anchors
  //TODO: cleanup emote
  //TODO: cleanup strong
  nlstring = '';
  paragraphs.each(function (ndex, pelem) {
    if (nlstring !== ''){
      nlstring += '\n\n' + $(pelem).text();
    }else{
      nlstring = $(pelem).text();
    }
  });
  return nlp(nlstring);
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

function count_nlp_nouns(comment_things) {
  result = {};
  $.each(comment_things, function (k, v) {
    nlparsed = paragraphsToNLP(get_thingParagraphs($(v.thing)));
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
