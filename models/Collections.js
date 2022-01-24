const mongoose = require("mongoose");
const passport = require("passport");
const session = require('express-session');


mongoose.connect("mongodb://localhost:27017/freeShareDB");
const userschema = new mongoose.Schema({
    username: String,
    password: String,

});
const bookschema = new mongoose.Schema({
    uuid: String,
    title: String,
    department: String,
    isdepartmentothers: Boolean,
    subdepartment: String,
    issubdepartmentothers: Boolean,

    book_img_url: String,
    book_url: String,

});
const initialreportschema = new mongoose.Schema({
    report_book_id: String,
    reported_email: String,
    report_otp: String,
})
const reportschema = new mongoose.Schema({
    report_book_id: String,
    report_book_title: String,
    report_book_subdepartment: String,
    report_book_department: String,
    report_book_url: String,

    reports: [{ subject: String, message: String }],
    reported_emails: [String],
    reports_count: Number,
});
//userschema.plugin(passportlocalmongoose); //automatically do hash+salt our passwords

const usermodel = mongoose.model("user", userschema);
const bookmodel = mongoose.model("book", bookschema);
const reportbookmodel = mongoose.model("report", reportschema);
const initialreportbookmodel = mongoose.model("initialreport", initialreportschema);
//passport.use(usermodel.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    usermodel.findById(id, function(err, user) {
        done(err, user);
    });
});

module.exports = {
    User: usermodel,
    Book: bookmodel,
    Report: reportbookmodel,
    InitialReport: initialreportbookmodel,
}