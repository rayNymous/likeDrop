var express = require('express');
var router = express.Router();
var fs = require('fs');
var config = JSON.parse(fs.readFileSync("./config.json",'utf8'));
var VK = require('vksdk');

var TimerTickNumber=0;
var intervalID;

var vk;
var checkList=[];
var check_offset=0;
var dropList=[];
var RUNNING=false;

var params={};

/* GET home page. */
router.get('/', function(req, res, next) {
  console.log("state: "+ RUNNING);

  res.render('index',
      {
        search:(!RUNNING)?'/start/':'/stop/',
        title: (!RUNNING)?'Search IS STOPPED':'Search IS RUNNING',
        likes0: config.likes[0],
        likes1: config.likes[1],
        likes2: config.likes[2],
        likeTimes0: config.likeTimes[0],
        likeTimes1: config.likeTimes[1],
        likeTimes2: config.likeTimes[2],
        timerValue: config.timerValue,
        QueryForDelete: config.QueryForDelete,
        QueryForPosts: config.QueryForPosts,
        PostsCount: config.PostsCount,
        QueryForDropThatStuff: config.QueryForDropThatStuff,
        dropLinks: config.dropLinks,
        vkGroupId: config.vkGroupId,
        vkAppId: config.vkAppId,
        vkAppSecret: config.vkAppSecret,
        vkLanguage: config.vkLanguage,
        vkHttps: config.vkHttps,
        vkSecure: config.vkSecure,
        OauthToken: config.OauthToken
      });
});

/*use search sop */
router.use('/stop/', function(req, res, next) {
  params=req.query;
  RUNNING=false;
  clearInterval(intervalID);

  console.log("/stop state: "+ RUNNING);
  res.render('search', {
    search:'/start/',
    title: 'Search IS STOPPED',
    likes0: params.likes0,
    likes1: params.likes1,
    likes2: params.likes2,
    likeTimes0: params.likeTimes0,
    likeTimes1: params.likeTimes1,
    likeTimes2: params.likeTimes2,
    timerValue: params.timerValue,
    QueryForDelete: params.QueryForDelete,
    QueryForPosts: params.QueryForPosts,
    PostsCount: params.PostsCount,
    QueryForDropThatStuff: params.QueryForDropThatStuff,
    dropLinks: params.dropLinks,
    vkGroupId: params.vkGroupId,
    vkAppId: params.vkAppId,
    vkAppSecret: params.vkAppSecret,
    vkLanguage: params.vkLanguage,
    vkHttps: params.vkHttps,
    vkSecure: params.vkSecure,
    OauthToken: params.OauthToken });

});

/*use search start */
router.use('/start/', function(req, res, next) {
  params=req.query;

  RUNNING=true;
  console.log("/start state: "+ RUNNING);

   vk = new VK({
    'appId'     : params.vkAppId,
    'appSecret' : params.vkAppSecret,
    'language'  : params.vkLanguage,
    'https' 	: (params.vkHttps  == 1),
    'secure'    : (params.vkSecure == 1)
  });

  vk.setToken(params.OauthToken);

  intervalID=setTimeout(vkRequest,config.timerValue);

  res.render('search', {
    search:'/stop/',
    title: 'Search IS RUNNING',
    likes0: params.likes0,
    likes1: params.likes1,
    likes2: params.likes2,
    likeTimes0: params.likeTimes0,
    likeTimes1: params.likeTimes1,
    likeTimes2: params.likeTimes2,
    timerValue: params.timerValue,
    QueryForDelete: params.QueryForDelete,
    QueryForPosts: params.QueryForPosts,
    PostsCount: params.PostsCount,
    QueryForDropThatStuff: params.QueryForDropThatStuff,
    dropLinks: params.dropLinks,
    vkGroupId: params.vkGroupId,
    vkAppId: params.vkAppId,
    vkAppSecret: params.vkAppSecret,
    vkLanguage: params.vkLanguage,
    vkHttps: params.vkHttps,
    vkSecure: params.vkSecure,
    OauthToken: params.OauthToken });

});

//tick function
function vkRequest()
{
  TimerTickNumber++;
  if((TimerTickNumber % params.QueryForPosts)==0)
  {
    QueryForPosts();
    TimerTickNumber=0;
  }
  else if((TimerTickNumber % params.QueryForDropThatStuff)==0)
  {
    QueryForDropThatStuff();
  }
  else if((TimerTickNumber % params.QueryForDelete)==0)
  {
    QueryForDelete();
  }

  clearTimeout(intervalID);
  intervalID=setTimeout(vkRequest,config.timerValue);
}

//get [[post_id][post_comment_count]] from response, and push it to checkList
function QueryForPosts()
{
  vk.request('execute.QueryForPosts',
      {
        'gid': params.vkGroupId,
        'count': params.PostsCount
      },
      function(o)
      {
          checkList = [];
          if (o.response == undefined)
          {
              if(config.isDebugEnabled==1)
                console.log("execute.QueryForPosts returns null")
          }
          else
          {
              if(config.isDebugEnabled==1)
                console.log("execute.QueryForPosts return value");

              checkList=[];
              var r = o.response;
              r.forEach(function (record)
              {
                  for (var i = 0; i < record[0].length; i++)
                  {
                      var id = record[0][i];
                      var comments = record[1][i];
                      if (comments > 0) {
                          checkList.push([id, comments]);
                      }
                  }
              })

              if(config.isDebugEnabled==1)console.log("checkPostList :"+checkList.toString());
          }
      }
  )
}

//удаляем пачкой посты из DropList содержащие ссылки
function QueryForDropThatStuff()
{
  if (dropList.length == 0 || params.dropLinks==0)
    return;

  var j = 0
  var comment_ids="";
  while (j < dropList.length )
  {
    var cid = dropList.pop();
    comment_ids+= cid+",";
    j++;
  }
  vk.request('execute.QueryDropThatStuff',
  {
    'group_id':params.vkGroupId,
    'comment_ids': comment_ids
  },
  function(o)
  {
      if (config.isDebugEnabled==1)
      {
          if(o.response == undefined)
          {
              console.log("execute.QueryForDropThatStuff received undefined response");
          }
          else
          {
              console.log("execute.QueryForDropThatStuff had worked at once");
          }
      }
  })
}

//drop post from CheckList. add posts that contains links to dropList;
function QueryForDelete() {
    if (checkList.length == 0)
        return;

    var record = checkList.pop();
    var id = record[0];
    var comments = record[1];
    var d = Math.floor(new Date().getTime() / 1000);
    var commentOffset = 0;

    //check for comments offset
    if (comments - check_offset <= 24) {
        commentOffset = check_offset;
        check_offset = 0;
    }
    else {
        //если каментов больше чем позволяет использовать втентакле.апи, мы возвращаем запись в список для проверки,
        // и увеличиваем смещение для выборки каментов
        commentOffset += check_offset;
        check_offset += 24;
        checkList.push(record);
    }

  /*  console.log("c " + commentOffset);
    console.log("gid " + parseInt(params.vkGroupId));
    console.log("id " + id);
    console.log("d" + d);
    console.log("drop " + params.dropLinks);
    console.log("l1 " + params.likes0);
    console.log("t1 " + params.likeTimes0);
    console.log("l2 " + params.likes1);
    console.log("t2 " + params.likeTimes1);
    console.log("l3 " + params.likes2);
    console.log("t3 " + params.likeTimes2);*/

    vk.request('execute.QueryForDelete',
        {
            'offset':commentOffset,
            'public_id': parseInt(params.vkGroupId),
            'post_id': id+"",
            'date': parseInt(d),
            'dropLinks': parseInt(params.dropLinks),
            'like1': parseInt(params.likes0),
            'time1': parseInt(params.likeTimes0),
            'like2': parseInt(params.likes1),
            'time2': parseInt(params.likeTimes1),
            'like3': parseInt(params.likes2),
            'time3': parseInt(params.likeTimes2)
        },
        function (o)
        {
            if (o.response == undefined)
            {
                if(config.isDebugEnabled ==1) {
                    console.log("execute.QueryForDelete returns null");
                }
                return;
            }
            else
            {
                if(config.isDebugEnabled==1) {
                    console.log("execute.QueryForDelete returns value");
                }
                var r = o.response;

                r.forEach(function (record) {
                    for (i = 0; i < record.length; i++)
                    {
                        var pid = record[0]; //post id
                        var cid = record[1]; //comment id
                        var txt = record[2]; //comment text

                        if (params.dropLinks!=0 && spellCHeck(txt))
                        {
                            if(dropList.indexOf(cid) == -1)
                                dropList.push(cid);
                        }
                    }
                });
                if(config.isDebugEnabled==1)
                    console.log("dropList post_ids :"+dropList.toString());
            }
        }
    );
}

//ну оооочень простой спеллчекер :3
function spellCHeck(text)
{
  if(text.toString().indexOf("http") > -1)
    return true;
  return false;
}

module.exports = router;
