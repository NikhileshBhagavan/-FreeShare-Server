require('dotenv').config()
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const cors = require('cors');
const md5 = require("md5");
const models = require("./models/Collections.js");
const flash = require('connect-flash');
const express = require("express");
const path = require("path");
const bodyparser = require("body-parser");
const ejs = require('ejs');
const session = require('express-session');
const passport = require("passport");
const nodemailer = require('nodemailer');


const app = express();
app.use(bodyparser.urlencoded({
    extended: false
}));
app.use(cors());
app.use(flash());
app.use(bodyparser.json());
app.use(express.static('public'));

app.set('view engine', 'ejs');
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 86400000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

const multer = require('multer');
const { model } = require('mongoose');
var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        console.log(file);
        cb(null, 'uploads/' + path.extname(file.originalname).substring(1));
    },
    filename: function(req, file, cb) {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
})

var upload = multer({ storage: storage });
app.get("/books", function(req, res) {
    models.Book.find({}, function(err, docs) {
        if (err) {
            res.json({ message: "Error" });
        } else {
            res.json({
                message: "Success",
                books: docs
            });
        }
    });

});

app.get("/uploads/:format/:id", function(req, res) {
    if (fs.existsSync(path.join(__dirname, "uploads/" + req.params["format"] + "/" + req.params["id"] + "." + req.params["format"]))) {
        res.sendFile(path.join(__dirname, "uploads/" + req.params["format"] + "/" + req.params["id"] + "." + req.params["format"]));
    } else {
        res.render("notfound");
    }

});

app.post("/api/bookupload", upload.fields([{ name: 'book_img', maxCount: 1 }, { name: 'book_pdf', maxCount: 1 }]), function(req, res) {
    console.log(req.files, req.body);
    let img_url = null;
    let pdf_url = "/" + req.files.book_pdf[0].path.split(".")[0];
    console.log("hi1");

    if (req.body.isimageuploaded === 'false') {
        img_url = "/uploads/png/default";
        console.log("hi2");
    } else {
        img_url = "/" + req.files.book_img[0].path.split(".")[0];
        console.log("hi3");


    }
    const book = new models.Book({
        uuid: uuidv4(),
        title: req.body.title,
        department: req.body.department,
        isdepartmentothers: req.body.isdepartmentothers == "true",
        subdepartment: req.body.subdepartment,
        issubdepartmentothers: req.body.issubdepartmentothers == "true",
        book_img_url: img_url,
        book_url: pdf_url,
        isreported: false,
    });
    book.save(function(err) {
        if (err) {
            res.json({ message: "error" });
        }
        console.log(img_url, pdf_url);
        console.log(req.body);


        res.json({ message: "success" });
    })


});

function generateOTP() {

    // Declare a digits variable 
    // which stores all digits
    var digits = '0123456789';
    let OTP = '';
    for (let i = 0; i < 6; i++) {
        OTP += digits[Math.floor(Math.random() * 10)];
    }
    return OTP;
}

app.post("/initialreport", function(req, res) {
    console.log(req.body);
    models.Report.findOne({ report_book_id: req.body.book_uuid }, function(err, adventure) {
        if (err) {
            res.json({ message: "Error, Click Send OTP again" });
        } else {

            if (adventure !== null && adventure.reported_emails.includes(req.body.email)) {
                res.json({ message: "Your last report Haven't been resolved yet. Try Reporting after some days" });
            } else {
                models.InitialReport.findOne({ report_book_id: req.body.book_uuid, reported_email: req.body.email },
                    function(err, initialreport) {
                        if (err) {
                            res.json({ message: "Error, Click Send OTP again" });
                        } else {
                            let a = generateOTP();
                            var transporter = nodemailer.createTransport({
                                service: 'gmail',
                                auth: {
                                    user: process.env.EMAIL,
                                    pass: process.env.PASSWORD
                                }
                            });
                            var mailOptions = {
                                from: process.env.EMAIL,
                                to: "" + req.body.email,
                                subject: 'Email Confirmation OTP for Book Id : ' + req.body.book_uuid,
                                text: "OTP is" + " " + a
                            };

                            transporter.sendMail(mailOptions, function(error, info) {
                                if (error) {
                                    res.json({ message: "Error, Click Send OTP again" });
                                } else {
                                    if (initialreport !== null) {
                                        initialreport.report_otp = md5(a);
                                        initialreport.save(function(err) {
                                            if (err) {
                                                res.json({ message: "Error, Click Send OTP again" });
                                            } else {
                                                res.json({ message: " OTP have been sent to Your Email for Confirmation" });
                                            }
                                        });

                                    } else {
                                        var obj = new models.InitialReport({
                                            report_book_id: req.body.book_uuid,
                                            reported_email: req.body.email,
                                            report_otp: md5(a)
                                        });
                                        obj.save(function(err) {
                                            if (err) {
                                                res.json({ message: "Error, Click Send OTP again" });
                                            } else {
                                                res.json({ message: " OTP have been sent to Your Email for Confirmation" });
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    });

            }

        }
    });

});
app.post("/report", function(req, res) {
    console.log(req.body);
    models.InitialReport.findOne({ report_book_id: req.body.report_book_id, reported_email: req.body.report_email },
        function(err, rep) {
            if (err) {
                res.json({ message: "Error , Try Submitting Again After some time..." });
            } else {
                if (rep !== null && rep.report_otp === md5(req.body.report_otp)) {
                    models.Report.findOne({ report_book_id: req.body.report_book_id }, function(err, report) {
                        if (err) {
                            res.json({ message: "Error , Try Submitting Again After some time..." });
                        } else {
                            if (report !== null) {
                                report.reports.push({ subject: req.body.report_subject, message: req.body.report_message });
                                report.reported_emails.push(req.body.report_email);
                                report.reports_count = report.reports_count + 1;
                                report.save(function(err) {
                                    if (err) {
                                        res.json({ message: "Error , Try Submitting Again After some time..." });
                                    } else {
                                        res.json({ message: "success" });
                                    }
                                });

                            } else {
                                models.Book.findOne({ uuid: req.body.report_book_id }, function(err, docs) {
                                    if (err) {
                                        res.json({ message: "Error , Try Submitting Again After some time..." });
                                    } else {
                                        const obj = new models.Report({
                                            report_book_id: req.body.report_book_id,
                                            report_book_title: docs.title,
                                            report_book_subdepartment: docs.subdepartment,
                                            report_book_department: docs.department,
                                            report_book_url: docs.book_url,
                                            reports: [{ subject: req.body.report_subject, message: req.body.report_message }],
                                            reported_emails: [req.body.report_email],
                                            reports_count: 1

                                        });
                                        obj.save(function(err) {
                                            if (err) {
                                                res.json({ message: "Error , Try Submitting Again After some time..." });
                                            } else {
                                                res.json({ message: "success" });
                                            }
                                        });
                                    }
                                });
                            }
                        }
                    });
                } else {
                    res.json({ message: "Invalid OTP or You haven't clicked Send OTP... " });
                }
            }
        });
});
app.get("/admin", function(req, res) {
    res.render("adminlogin", { messages: req.flash("error") });

});
app.post("/admin", function(req, res) {
    models.User.findOne({ username: req.body.username, password: md5(req.body.password) }, function(err, user) {
        if (err) {
            req.flash("error", "Error,Try Again");
            res.redirect("/admin");
        }
        if (user == null) {
            req.flash("error", "Invalid Username Or Password");
            res.redirect("/admin");
        } else {
            req.login(user, function(error) {
                if (error) {
                    req.flash("error", "Error,Try Again");
                    res.redirect("/admin");
                }
                res.redirect("/adminhomepage");
            })
        }
    })
});
app.get("/adminhomepage", function(req, res) {
    if (req.isAuthenticated()) {
        models.Report.find({}, function(err, docs) {
            if (err) {
                res.render("notfound");
            } else {
                function comparecount(a, b) {



                    let comparison = 0;

                    if (a.reports_count < b.reports_count) {
                        comparison = 1;
                    } else if (a.reports_count > b.reports_count) {
                        comparison = -1;
                    }
                    return comparison;
                }
                let arr = docs.sort(comparecount)
                console.log(arr);


                res.render("adminhomepage", { obj: arr });
            }
        })


    } else {
        res.render("nonauthenticated");
    }
});
app.get("/adminlogout", function(req, res) {

    req.logout();
    req.session.destroy(function(err) {
        res.redirect("/admin");
    });

});
app.post("/admin/report", function(req, res) {
    console.log(req.body);

    models.Report.findOne({ report_book_id: req.body.book_id }, function(error, rep) {
        if (error) {
            res.json({ message: "error" });
        } else {
            let list = [];
            for (let i = 0; i < rep.reported_emails.length; i++) {
                list.push(rep.reported_emails[i]);
            }
            let bookname = rep.report_book_title;
            let bookpath = rep.report_book_url.substring(1);
            if (req.body.status === "reportapproved") {
                models.Book.deleteOne({ uuid: req.body.book_id }, function(err) {
                    if (err) {
                        res.json({ message: "error" });
                    } else {
                        require('fs').unlinkSync(path.join(__dirname, bookpath + '.pdf'));

                        models.Report.deleteOne({ report_book_id: req.body.book_id }, function(err) {
                            if (err) {
                                res.json({ message: "error" });
                            } else {
                                var transporter = nodemailer.createTransport({
                                    service: 'gmail',
                                    auth: {
                                        user: process.env.EMAIL,
                                        pass: process.env.PASSWORD
                                    }
                                });
                                var mailOptions = {
                                    from: process.env.EMAIL,
                                    to: list,
                                    subject: bookname + " Report Update",
                                    text: req.body.feedback
                                };
                                transporter.sendMail(mailOptions, function(e, info) {
                                    res.json({ message: "success" });
                                });

                            }
                        });
                    }
                });
            } else {
                models.Report.deleteOne({ report_book_id: req.body.book_id }, function(err) {
                    if (err) {
                        res.json({ message: "error" });
                    } else {
                        var transporter = nodemailer.createTransport({
                            service: 'gmail',
                            auth: {
                                user: process.env.EMAIL,
                                pass: process.env.PASSWORD
                            }
                        });
                        var mailOptions = {
                            from: process.env.EMAIL,
                            to: list,
                            subject: bookname + " Report Update",
                            text: req.body.feedback
                        };
                        transporter.sendMail(mailOptions, function(e, info) {
                            res.json({ message: "success" });
                        });

                    }
                });
            }



        }
    });


});


app.get("/*", function(req, res) {
    res.render("index.ejs", { user: "hi" });
});
app.listen(8000, () => {
    console.log("listening to port 8000");
});

//https://semantic-ui.com/modules/popup.html