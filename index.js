var express = require('express');
var session = require('express-session');
var app = express();
var moment = require('moment');
var bodyParser = require('body-parser');
var multer = require('multer');

// User account vars
// var User = require('./user.js');
const https = require('https');
const imgFolder = './public/img';
const imgFolderPosts = './post-images/'
const fs = require('fs');

const certOptions = {
        cert: fs.readFileSync('/etc/letsencrypt/live/macclark.io/fullchain.pem'),
        key: fs.readFileSync('/etc/letsencrypt/live/macclark.io/privkey.pem')
};

// Begin file upload setup via multer

var storage = multer.diskStorage({
	destination: function(req, file, callback) {
		callback(null, imgFolderPosts);
	},
	filename: function(req, file, callback) {
		callback(null, "blog-post-image-" + file.originalname);
	}
});

var upload = multer({
     storage: storage
 }).array("filetoupload", 1); //Field name and max count

// End file upload setup via multer

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 
app.locals.moment = require('moment');

var mongoose = require('mongoose');

var mongoDB = 'mongodb://127.0.0.1/blog';
mongoose.connect(mongoDB);
// Get Mongoose to use the global promise library
mongoose.Promise = global.Promise;
//Get the default connection
var db = mongoose.connection;
//Bind connection to error event (to get notification of connection errors)
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Define schema
var Schema = mongoose.Schema;

var PostSchema = Schema({
    title: String,
    author: String,
    created: { type: Date, default: Date.now },
    body: String,
    image: String // path to post-related image
});

// Compile model from schema
var PostModel = mongoose.model('PostModel', PostSchema );

// Tracking for logins
app.use(session({
    secret: 'work hard',
    resave: true,
    saveUninitialized: false
}));

app.use(express.static('public'));
app.set('view engine', 'pug');

// Health checks for SSL
app.get('/health-check', (req, res) => res.sendStatus(200));
app.use(express.static('static'));

function wwwRedirect(req, res, next) {
        console.log(req.headers['x-forwarded-for']);
        if (req.headers.host.slice(0, 4) === 'www.') {
        console.log('test');
            var newHost = req.headers.host.slice(4);
                    return res.redirect(301, req.protocol + '://' + newHost + req.originalUrl);
                }
        next();
};

app.set('trust proxy', true);
app.use(wwwRedirect);

app.get('/', function(req, res) {
	PostModel.find({}, 'title created body author image', 
	function (err, posts) {

		// Sort posts by creation date
		posts.sort(function(a, b) {
			a = new Date(a.created);
			b = new Date(b.created);
			return a>b ? -1 : a<b ? 1 : 0;
		});

        var images = []; 
		fs.readdirSync(imgFolder).forEach(file => {
			// console.log(file);
			images.push(file);
		});
		
		if (err) return console.log(err);
        // console.log(posts);
		res.render('index', {
			posts: posts,
			images: images,
            req: req,
		});
	});
});

app.get('/add', function(req, res) {
	res.render('add'); // renders index.pug
});

app.post('/add/submit', function(req, res) {
	// console.log(req.body.author);

	upload(req, res, function(err) {
         if (err) {
             return console.log(err);
         }
         // console.log(req.files[0].filename);
        if (req.files.length > 0) {
          dbWrite(req, res, req.files[0].filename);
        }
        else {
          dbWriteNoFile(req, res);
        }
      });	
});

// // GET route for user creation
// app.get('/enroll', function(req, res) {
//     res.render('enroll');
// });
//
// // POST route for user creation
// app.post('/enroll-submit', function(req, res) {
//     if (req.body.email &&
//     req.body.username &&
//     req.body.password &&
//     req.body.passwordConf) {
//         var userData = {
//             email: req.body.email,
//             username: req.body.username,
//             password: req.body.password,
//             passwordConf: req.body.passwordConf,
//         }
//         console.log(userData);
//         //use schema.create to insert data into the db
//         User.create(userData, function (err, user) {
//             if (err) {
//                 return next(err)
//             } else {
//                 return res.redirect('/profile');
//             }
//         });
//     } 
// });

// Account creation page
app.get('/profile', function(req, res) {
    res.render('profile');
});

// Login page
app.get('/login', function(req, res) {
    res.render('login');
});

// app.post('/login-submit', function(req, res) {
//
//   if (req.body.email && req.body.password) {
//     User.authenticate(req.body.email, req.body.password, function (error, user) {
//       if (error || !user) {
//         var err = new Error('Wrong email or password.');
//         console.log(error);
// 		err.status = 401;
//         res.send(err);
//       } else {
//         req.session.userId = user._id;
//         req.session.userName = user.username;
//         res.redirect('/');
//       }
//     });
//   } else {
//     var err = new Error('All fields required.');
//     err.status = 400;
//     res.send(err);
//   }
// });

app.get('/edit/:id', function(req, res) {
    var id = req.params.id;
    PostModel.find({"_id": id}, 'title body', function(err, posts) {
        console.log(posts[0]);
        res.render('edit-post', {
            id: id,
            currentTitle: posts[0].title,
            currentBody: posts[0].body
        });
    });
});

function dbWrite(req, res, filename) {
	// console.log(filename);
	PostModel.create({ 
		title: req.body.title,
                author: req.body.author,
		created: Date.now(),
		body: req.body.body,
		image: filename
	}, function (err, awesome_instance) {
		if (err) console.log(err);
  		// saved!
	});
	res.redirect('/');
}

function dbWriteNoFile(req, res) {
  PostModel.create({
    title: req.body.title,
    author: req.body.author,
    created: Date.now(),
    body: req.body.body
  }, function (err, awesome_instance) {
    if (err) console.log(err);
    //saved!
  });
  res.redirect('/');
}


var httpsServer = https.createServer(certOptions, app);


app.listen(3001, function() {
  console.log('Blog app listening on port 3001!');
});
