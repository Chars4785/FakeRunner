var socketio = require('socket.io');
var express = require('express');

var http = require('http');

var app = express();
var serv = http.createServer(app);
var io = socketio.listen(serv);

//var mongojs = require("mongojs");
//var db = mongojs(process.env.MONGODB_URI, ['fake']);

var AWS = require("aws-sdk");

AWS.config.update({
    region: "us-esat-1",
    endpoint: "http://dynamodb.us-east-1.amazonaws.com",
    accessKeyId: "",
    secretAccessKey: ""
});
//
var docClient = new AWS.DynamoDB.DocumentClient();

serv.listen(process.env.PORT || 80, function() {
    console.log('!!');
});

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client/index2.html');
});

app.use('/client', express.static(__dirname + '/client'));


var SOCKET_LIST = {};

var Entity = function() {

    var self = {
        x: Math.floor((Math.random() * (580 + 1))),
        y: Math.floor((Math.random() * (580 + 1))),
        spdX: 0,
        spdY: 0,
        id: "",
    }
    self.update = function() {
        self.updatePosition();
    }

    self.updatePosition = function() {
            self.x += self.spdX;
            self.y += self.spdY;
        }
        //본인이 설정한 속도 만큼 x,y가 변함

    self.getDistance = function(pt) {
            return Math.sqrt(Math.pow(self.x - pt.x, 2) + Math.pow(self.y - pt.y, 2));
        }
        // 두 물체간에 거리를 피타고라스 방정식으로 구한다. 

    return self;
}

var Enemy = function() {
    var self = Entity();
    self.x = Math.floor((Math.random() * (620 - (-20) + 1)) + (-20));
    self.y = Math.floor((Math.random() * (620 - (-5) + 1)) + (-20));
    self.id = Math.random() * 100;
    self.spX = Math.floor((Math.random() * (5 - (-5) + 1)) + (-5));
    self.spY = Math.floor((Math.random() * (5 - (-5) + 1)) + (-5));
    self.remove = false;
    self.timer = Math.floor((Math.random() * 100));
    self.keyX = 0;
    self.keyY = 0;
    self.hp = 1;

    // n1 은 "하한값", n2 는 "상한값"
    self.enemycount = 0;

    var super_update = self.update;

    self.update = function() {
        super_update();
        self.updateSpd();
        if (self.timer++ > 300) {
            self.remove = true;
        }

        self.keyX += (228 / 6);

        if (self.keyX > 190)
            self.keyX = 0;

    }

    self.updateSpd = function() {

        self.spdX = self.spX;
        self.spdY = self.spY;
        if (self.spX < 0) {

            self.keyY = 0;

        } else {

            self.keyY = 47;

        }

    }

    //10몇의 ai를 만들어야 한다. 

    Enemy.list[self.id] = self;
    return self;

}

Enemy.list = {};

Enemy.start = function() {
    var cc = Object.keys(Enemy.list).length

    //9-10
    if (cc < 20)
        Enemy();

}

//pack에  넣는 함수
Enemy.update = function() {
    var pack = [];
    for (var i in Enemy.list) {
        var enemy = Enemy.list[i];
        enemy.update();

        if (enemy.remove) {
            delete Enemy.list[i];

        } else
            pack.push({
                x: enemy.x,
                y: enemy.y,
                keyX: enemy.keyX,
                keyY: enemy.keyY,
                hp: enemy.hp,
            });

    }

    return pack;
}





var Player = function(id, username) {
    var self = Entity();
    //객체 받기
    self.username = username;
    self.id = id;
    //socket 고유 넘버
    self.number = "" + Math.floor(10 * Math.random());
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.pressingAttack = false;
    self.mouseAngle = 0;
    self.maxSpd = 5;
    self.imageW = 228 / 6;
    self.imageH = 47;
    self.keyX = 0;
    self.keyY = 0;
    self.hp = 1;
    self.count = 15;
    self.score = 0;
    // 변수 선언

    var super_update = self.update;
    // 부모 객체 재생성 

    self.update = function() {
        self.updateSpd();
        super_update();

        if (self.count >= 0) {

            if (self.pressingAttack) {
                self.shootBullet(self.mouseAngle);
            }
        }
    }

    self.shootBullet = function(angle) {
        var b = Bullet(self.id, angle, self.hp);
        b.x = self.x;
        b.y = self.y;
    }




    self.updateSpd = function() {
        if (self.pressingRight) {
            self.spdX = self.maxSpd;
            self.keyY = self.imageH;
            self.keyX += self.imageW;
        } else if (self.pressingLeft) {
            self.spdX = -self.maxSpd;
            self.keyY = 0;
            self.keyX += self.imageW;
        } else
            self.spdX = 0;

        if (self.pressingUp) {
            self.spdY = -self.maxSpd;
            self.keyX += self.imageW;
        } else if (self.pressingDown) {
            self.spdY = self.maxSpd;
            self.keyX += self.imageW;
        } else
            self.spdY = 0;

        if (self.keyX >= 228)
            self.keyX = 0;
    }


    Player.list[id] = self;
    return self;

    // 배열에 각 플레이어 갯수 만큼 넣어 주기 
}


Player.list = {};
//플레이어 배열 리스트

Player.onConnect = function(socket, username) {
    var player = Player(socket.id, username);
    // 소켓에서 제공해주는 아이디가 플레이어 아이디가 된다.

    // 누른것에 따른 변수명 변경 
    socket.on('keyPress', function(data) {
        if (data.inputId === 'left')
            player.pressingLeft = data.state;
        else if (data.inputId === 'right')
            player.pressingRight = data.state;
        else if (data.inputId === 'up')
            player.pressingUp = data.state;
        else if (data.inputId === 'down')
            player.pressingDown = data.state;
        else if (data.inputId === 'attack') {
            player.pressingAttack = data.state;
            player.count = player.count - (5 / 10);
        } else if (data.inputId === 'mouseAngle')
            player.mouseAngle = data.state;
    });

    socket.on('sendMsgToServer', function(data) {
        //var playerName = ("" + username).slice(2,7);
        //플레이어 이름 나누기 
        for (var i in SOCKET_LIST) {
            SOCKET_LIST[i].emit('addToChat', username + ': ' + data);
        }
    });


}



Player.onDisconnect = function(socket) {
    delete Player.list[socket.id];
    // 서버를 나가게 되면 그 플레이어는 삭제( 리스트에서 )
}


Player.update = function() {
    var pack = [];
    for (var i in Player.list) {
        var player = Player.list[i];
        player.update();
        pack.push({
            x: player.x,
            y: player.y,
            number: player.number,
            keyX: player.keyX,
            keyY: player.keyY,
            hp: player.hp,
            count: player.count,
            score: player.score,
        });
    }
    // pack 넣어서 넘길값들 emit함
    return pack;
}


var Bullet = function(parent, angle, hp) {
    var self = Entity();
    self.hp = hp;
    self.id = Math.random();
    self.spdX = Math.cos(angle / 180 * Math.PI) * 10;
    self.spdY = Math.sin(angle / 180 * Math.PI) * 10;
    self.parent = parent;
    self.timer = 0;
    self.toRemove = false;



    var super_update = self.update;
    //받은 객체 함수 추가

    self.update = function() {
        if (self.timer++ > 100)
            self.toRemove = true;
        super_update();

        for (var i in Player.list) {
            var p = Player.list[i];

            if (self.getDistance(p) < 32 && self.parent !== p.id) {
                p.hp -= 1;

                self.toRemove = true;

                if (p.hp <= 0) {
                    var shooter = Player.list[self.parent];
                    if (shooter)
                        shooter.score += 1;

                }

                //죽었을 경우 
                var params = {
                    TableName: table,
                    Item: {
                        "faker": Player.list[i].username,
                        "num": Player.list[i].score
                    }
                };

                docClient.delete(params, function(err, data) {
                    if (err) {
                        console.error("Unable to delete item. Error JSON:", JSON.stringify(err, null, 2));
                    } else {
                        console.log("DeleteItem succeeded:", JSON.stringify(data, null, 2));
                    }
                });

                delete Player.list[i];
            }
        }


        for (var i in Enemy.list) {
            var p = Enemy.list[i];

            if (self.getDistance(p) < 32) {
                self.toRemove = true;
                delete Enemy.list[i];

            }
        }
    }

    Bullet.list[self.id] = self;
    return self;
}

Bullet.list = {};

Bullet.update = function() {
    var pack = [];
    for (var i in Bullet.list) {
        var bullet = Bullet.list[i];
        bullet.update();

        if (bullet.toRemove) {
            delete Bullet.list[i];

        } else
            pack.push({
                x: bullet.x,
                y: bullet.y,

            });
    }
    return pack;
}

var DEBUG = true;

// 받은 정보 가공하는 부분

var ValidId = function(data) {

    var params = {
        TableName: table,
        Key: {
            "faker": data.id,
        }
    };

    //이미 있다면 false
    docClient.get(params, function(err, cd) {
        if (err) {
            console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2)); //존재 한다는 뜻이다.
            cd(false);
        } else {
            if (data.Item) {
                //존재 안하면
                cd(true);
            } else {
                //존재 하면
                cd(false);
            }
        }
    });

    // db.find({id:data.id},function(err,res){
    //     if(res.length > 0) //하나 존재한다는 뜻이다.
    //         cb(false);
    //     else{
    // 		db = new db({id:data.id,score:'0'});
    // 		db.save(function(err){
    // 			if(err){
    // 				console.log("Erro");
    // 			}
    // 		});
    //         cb(true);

    // 	}
    // });

}

////////////////////////
var docss = [];

io.sockets.on('connection', function(socket) {
    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;




    // //항상 접속 가능
    // socket.on('signIn', function(data) {
    //     socket.emit('rank', docss);
    //     ValidPassword(data, function(res) {
    //         if (res) {
    //             Player.onConnect(socket, data.id);
    //             socket.emit('signInResponse', { success: true });

    //         } else {
    //             socket.emit('signInResponse', { success: false });
    //         }
    //     });
    // });




    socket.on('signIn', function(data) {

        Player.onConnect(socket, data.id);
        // db.fake.insert({ id: data.id, score: 0 }, function(err) {
        // });
        // ValidId(data, function(res) {
        //     if (res) {

        //         var params = {
        //             TableName: "username",
        //             Item: {
        //                 faker: data.id,
        //                 value: 0
        //             }
        //         };

        //         docClient.put(params, function(err, data) {
        //             if (err) {
        //                 console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
        //             } else {
        //                 console.log("Added item:", JSON.stringify(data, null, 2));
        //             }
        //         });

        //         Player.onConnect(socket, data.id);
        //         socket.emit('rank', docss);
        //         socket.emit('signInResponse', { success: true });


        //     } else {
        //         socket.emit('signInResponse', { success: false });
        //     }
        // });



    });




    socket.on('disconnect', function() {
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
    });



    socket.on('evalServer', function(data) {
        if (!DEBUG)
            return;
        var res = eval(data);
        socket.emit('evalAnswer', res);
    });



});

// var uu = function() {

//     db.fake.find().sort({ score: -1 }, function(err, res) {
//         docss = res;
//     });

// }


// setInterval(uu, 1000);




setInterval(function() {

    Enemy.start();

    var pack = {
        player: Player.update(),
        bullet: Bullet.update(),
        enemy: Enemy.update(),
    }

    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST[i];
        socket.emit('newPositions', pack);

    }



}, 1000 / 25);