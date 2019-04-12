exports.resetpassword = function(req, res) {
    var data = req.body;

    async.waterfall([
        function(done) {
            User.findOne({
                resetPasswordToken: req.body.token,
                resetPasswordExpires: {
                    $gt: Date.now()
                }
            }, function(err, user) {
                if (!user) {
                    res.render('tinypage/regnotify', {
                        title: "Something is wrong",
                        alerttype: "alert-danger",
                        message: "Something wrong with your password change."
                    });
                } else {
                    user.password = req.body.password;
                    user.resetPasswordToken = '';
                    user.resetPasswordExpires = '';
                    user.save(function(err, user) {
                        done(err, user);
                    });
                }
            });
        },

        function(user, done) {
            var smtpTransport = nodemailer.createTransport('SMTP', {
                service: 'Mailgun',
                auth: {
                    user: 'sdfa',
                    pass: 'afdafsa'
                }
            });

            var mailOptions = {
                to: user.email,
                from: 'agdtrack@s.com',
                subject: 'Your password has been changed',
                text: 'Hello,\n\n' +
                'This is a confirmation that the password for your account ' + req.body.token + ' has just been changed.\n'
            };

            smtpTransport.sendMail(mailOptions, function(err) {
                if (err) {
                    res.render('tinypage/regnotify', {
                        title: "Wrong",
                        alerttype: "alert-danger",
                        message: "Something wrong"
                    });
                } else {
                    return res.render('tinypage/regnotify', {
                        title: "Success",
                        alerttype: "alert-success",
                        message: "Success! Your password has been changed."
                    });
                    done(err);
                }
            });
        }
    ], function(err) {
        res.redirect('/');
    });
};

exports.renderresetpage = function(req, res) {
    res.render('reset');
};
