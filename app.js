const express = require('express');
const app = express();
const mysql = require('mysql');
const session = require('express-session');
const dotenv= require("dotenv");
const path = require("path")
const bodyParser = require("body-parser");
const { CLIENT_FOUND_ROWS } = require('mysql/lib/protocol/constants/client');

dotenv.config({path: './.env'})

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,  //put ip address if not running on localhost
    user: process.env.DATABASE_USER,
    password:process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE,
});

const publicDirectory = path.join(__dirname, "./public")//put css or javascript for frontend
app.use(express.static(publicDirectory))

//parse URL-encoded bodies (as sent by html forms)
app.use(express.urlencoded({extended:false}));
//parse JSON bodies (as sent by API clients)
app.use(express.json());


app.set("view engine", "hbs");

db.connect((error)=> {
    if(error) {
        console.log(error)
    }
    else{
        console.log("MY SQL Connected..")
    }
})

//Define Routes
app.use("/", require("./routes/pages"))
app.use("/auth", require("./routes/auth"));

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 1000 *60 * 60 *24 }
}));


app.listen(5001, () => {
    console.log("Sever started on Port 5001")
});

// app.get("/",(req,res)=>{
//     res.render("index");
// });
//
// app.get("/landlordCreateAccount",(req,res)=>{
//     res.render("landlordCreateAccount");
// });
//
// app.get("/studentCreateAccount",(req,res)=>{
//     res.render("studentCreateAccount");
// });

app.post('/auth/index', function(req, res) {
    const {username, password} = req.body;
    if (username && password) {
        db.query('SELECT username,password,adminPerms FROM account WHERE username = ? AND password = ?', [username, password], function(error, results, fields) {
            if (results.length > 0) {
                req.session.loggedin = true;
                req.session.username = username;
                if (results[0].adminPerms === 0) {  //0 is for student
                    res.redirect("/studentProfile");
                }
                else if (results[0].adminPerms === 1) {   //1 is for landlord
                    res.redirect('/landlordProfile');
                }
                else if (results[0].adminPerms === 2) {    //2 is for admin
                    res.redirect('/adminLanding');
                }

            } else {
                return res.render("index",{
                    message: "Incorrect Username and/or Password"
                });
            }
        });
    } else {
        return res.render("studentCreateAccount",{
            message: "Incorrect Username and/or Password"
        });
    }
});

app.get('/adminLanding', function(req, res) {
    if (req.session.loggedin) {
        var listingData = null;
        var signupData = null;
        db.query('SELECT a.username, a.fullname, COUNT(*) AS numListings, CASE WHEN a.adminPerms = 0 THEN \'Student\' WHEN a.adminPerms = 1 THEN \'Landlord\' END AS accountType FROM account a INNER JOIN listing l ON a.username = l.username GROUP BY l.username ORDER BY COUNT(*) DESC', function(error, results, fields) {
            listingData = results;
            db.query('SELECT DATE_FORMAT(date_registered, \'%W %m/%d/%Y\') AS date, COUNT(*) AS numAccountsRegistered FROM account GROUP BY DATE(date_registered)', function(error, results, fields) {
                signupData = results;
                if (listingData && signupData) {
                    return res.render('adminLanding', {listingData: listingData, signupData: signupData});
                }
                else {
                    return res.render('adminLanding', {message: 'There was an error fetching statistics!'});
                }
            });
        });
        //return res.render('adminLanding', {listingData: listingData, signupData: signupData});
        //res.render('adminLanding');
    } else {
        res.send('Please login to view this page!');
    }
});

app.get('/adminManagingListings', function(req, res) {
    if (req.session.loggedin) {
        res.render('adminManagingListings');
    } else { 
        res.send('Please login to view this page!');
    }
}); 

app.get('/adminManagingUsers', function(req, res) {
    if (req.session.loggedin) {
        res.render('adminManagingUsers');
    } else { 
        res.send('Please login to view this page!');
    }
});



app.post('/adminManagingListings/getListing', function(req, res) {
    const housingId = req.body.listingID;

    if (housingId) {
        db.query('SELECT listingId, address, username, date_created, last_modified, link, description FROM listing WHERE listingId = ?', [housingId], function(error, results, fields) {
            if (results.length > 0) {
                return res.render('adminManagingListings', {listingId: results[0].listingId, address: results[0].address, username: results[0].username, date_created: results[0].date_created, last_modified: results[0].last_modified, link: results[0].link, description: results[0].description});
            } else {
                return res.render('adminManagingListings', {message: 'Listing not found!'});
            }
            res.end();
        });
    }
    else {
        return res.render('adminManagingListings', {message: 'Please enter a value!'}); 
    }
});

app.post('/adminManagingListings/deleteListing', function(req, res) {
    const housingId = req.body.listingID;

    if (housingId) {
        db.query('DELETE FROM listing WHERE listingId = ?', [housingId], function(error, results, fields) {
            if (results && error === null) {
                return res.render('adminManagingListings', {message: 'Listing deleted!'});
            } else {
                return res.render('adminManagingListings', {message: 'There was an error deleting this listing! It may have been deleted already.'});
            }
            res.end();
        });
    }
    else {
        return res.render('adminManagingListings', {message: 'Please enter a value!'});
    }
});

app.post('/adminManagingUsers/getUser', function(req, res) {
    const userId = req.body.username;

    if (userId) {
        db.query('SELECT username, email, fullname, adminPerms FROM account WHERE username = ? AND username != ?', [userId, req.session.username], function(error, results, fields) {
            if (results && results.length > 0) {
                return res.render('adminManagingUsers', {username: results[0].username, email: results[0].email, fullname: results[0].fullname, adminPerms: results[0].adminPerms});
            } else {
                return res.render('adminManagingUsers', {message: 'User not found!'});
            }
            res.end();
        });
    }
    else {
        return res.render('adminManagingUsers', {message: 'Please enter a value!'});
    }
});

app.post('/adminManagingUsers/deleteUser', function(req, res) {
    const userId = req.body.username;
    
    if (userId) {
        db.query('DELETE FROM account WHERE username = ?', [userId], function(error, results, fields) {
            console.log(results[0]);
            if (results && error === null) {
                return res.render('adminManagingUsers', {message: 'User deleted!'});
            } else {
                return res.render('adminManagingUsers', {message: 'There was an error deleting this user! They may have been deleted already.'});
            }
            res.end();
        });
    }
    else {
        return res.render('adminManagingUsers', {message: 'Please enter a value!'});
    }
});

app.get('/studentProfile', function(req, res) {
    if (req.session.loggedin) {
        // db.query("SELECT fullname, email FROM account WHERE username =?", [req.session.username], async (error, results) => {
        //     res.render("studentProfile", {account: results});
        // });
        db.query("SELECT fullname, email FROM account WHERE username =?", [req.session.username], (error, student) => {
            db.query("SELECT university, profile_description FROM student WHERE username=?", [req.session.username], (error, university)=>{
                if (error){
                    console.log(student);
                    console.log(error);
                }
                res.render("studentProfile", {fullname: student[0].fullname, email: student[0].email, university: student[0].university});
            })
        });
    } else {
        res.redirect('/');
    }
});


app.get('/landlordProfile', function(req, res) {
    if (req.session.loggedin) {
        //res.send('Welcome back, ' + req.session.username + '!');
        res.render("landlordProfile");
    } else {
        res.redirect('/');
    }
});



//not rendering username, fullname and university?
app.get("/editStudentProfile",(req,res)=>{
    if (req.session.loggedin) {
        // db.query("SELECT fullname, email FROM account WHERE username =?", [req.session.username], async (error, results) => {
        //     res.render("studentProfile", {account: results});
        // });
        db.query("SELECT fullname, email FROM account WHERE username =?", [req.session.username], (error, student) => {
            db.query("SELECT university,profile_description FROM student WHERE username=?", [req.session.username], (error, university)=>{
                if (error){
                    console.log(student);
                    console.log(error);
                }
                res.render("editStudentProfile", {fullname: student[0].fullname, email: student[0].email, university: university[0].university, profile_description: university[0].profile_description});
            })
        });
    } else {
        res.redirect('/');
    }
});

app.post("/editStudentProfile", (req ,res) => {
    if (req.session.loggedin) {
        const {editProfile}=req.body;
        db.query('UPDATE student SET ? WHERE username = ?', [{ profile_description: editProfile }, req.session.username], (error,results)=>{
            if (error){
                console.log(results);
                console.log(results);
            }
            db.query("SELECT fullname, email FROM account WHERE username =?", [req.session.username], (error, student) => {
                db.query("SELECT university,profile_description FROM student WHERE username=?", [req.session.username], (error, university)=>{
                    if (error){
                        console.log(student);
                        console.log(error);
                    }
                    res.render("studentProfile", {fullname: student[0].fullname, email: student[0].email, university: university[0].university, profile_description: university[0].profile_description});
                })
            });

        });
    }
    else {
        res.redirect('/');
    }

});

app.get("/createListingPage",(req,res)=>{
    if (req.session.loggedin) {
        res.render("createSubletPage");
    } else {
        res.redirect('/');
    }
});

app.get("/createSubletPage",(req,res)=>{
    if (req.session.loggedin) {
        res.render("createSubletPage");
    } else {
        res.redirect('/');
    }
});

app.get("/viewStudentSublet",(req,res)=>{
    if (req.session.loggedin) {
        //res.send('Welcome back, ' + req.session.username + '!');
        res.render("viewStudentSublet");
    } else {
        res.redirect('/');
    }
});

app.post('/housingProfile', function(req, res) {
    const housingId = req.body.listingId;
    console.log("ID: " + housingId);
    db.query('SELECT listingId, address, bath, number_of_room, description FROM listing WHERE listingId = ?',[housingId], function(error, results, fields) {
        
            return res.render('housingProfile', {listingId: results[0].listingId, address: results[0].address, bath: results[0].bath, number_of_room: results[0].number_of_room, description: results[0].description}); 
              
        res.end();
    });
});


app.post('/housingProfileForLandlords/getListing', function(req, res) {
    const housingId = req.body.listingID;
    console.log("ID: " + housingId);
    db.query('SELECT listingId, address, user email, bath, number of room FROM listing WHERE listingId = ?', [housingId], function(error, results, fields) {
        if (results) {
            return res.render('housingProfileForLandlords', {listingID: results[0].listingId, address: results[0].address, email: results[0].user_email, bath: results[0].bath, number_of_room: results[0].number_of_room, description: results[0].description});
        } else {
            return res.render('housingProfileForLandlords', {message: 'Listing not found!'});
        }
        res.end();
    });
});

app.get('/propertySearch', function(req, res) {
    if (req.session.loggedin) {
   
    db.query('SELECT listingId, address, bath, number_of_room FROM listing', function(error, results, fields) {
        if(error){
            console.log(error);
        }
        
        var properties = results;
        if (properties) {
           // return res.render('properties', {
          //      title : 'properties',
          //      properties: rows
           // })
          return res.render('propertySearch', {properties: properties});
              //listingID: results[0].listingId, address: results[0].address, username: results[0].username, bath: results[0].bath, number_of_room: results[0].number_of_room, description: results[0].description});
        } else {
            return res.render('propertySearch', {message: 'Listings not found!'});
        }
        res.end();
    });
}
else {
    res.send('Please login to view this page!');
}
});

app.get("/logout",(req,res)=>{
    req.session.destroy((err) => {
        if(err){
            return console.error(err)
        }
        console.log("The session has been destroyed!")
        res.redirect("/");
    })
});
