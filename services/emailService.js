const nodemailer = require('nodemailer');
const Mailgen = require('mailgen');

const transporter = nodemailer.createTransport({
    service: 'gmail', // your email domain
    auth: {
        user: process.env.SMTP_USERNAME,   // your email address
        pass: process.env.SMTP_PASSWORD // your password
    }
});

const generateOTP = () => {
    // Generate a 6-digit numeric OTP
    const otpLength = 6;
    const min = Math.pow(10, otpLength - 1);
    const max = Math.pow(10, otpLength) - 1;
    const resetPasswordTokenNumber = Math.floor(Math.random() * (max - min + 1)) + min;
      
    return resetPasswordTokenNumber
};

const sendEmail = async (to, subject, html, otp) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_USERNAME,
            to: to,
            subject: subject,
            html: html,
        });

        return {
            success: true,
            messageId: info.messageId,
            preview: nodemailer.getTestMessageUrl(info),
        };
    } catch (error) {
        console.error('Error sending email:', error.message);

        return {
            success: false,
            message: 'Error sending email',
            error: error.message,
        };
    }
};

const sendOTP = async (fullName, intro, instructions, email, subject, otp) => {
    try {
        const mailGenerator = new Mailgen({
            theme: 'default',
            product: {
                name: 'E-Commerce',
                link: 'https://mailgen.js/'
            }
        });

        const response = {
            body: {
                signature: false,
                // greeting: false,
                name: fullName,
                intro: intro,
                action: {
                    instructions: instructions,
                    button: {
                        color: '#22BC66',
                        text: otp
                    }
                }
            }
        };

        const mail = mailGenerator.generate(response);
        
        return await sendEmail(email, subject, mail, otp);
    } catch (error) {
        console.error('Error generating OTP:', error.message);

        return {
            success: false,
            message: 'Error generating OTP',
            error: error.message,
        };
    }
};

const sendCreds = async (email, otp) => {
    try {

        const subject = 'Welcome New Member!';
        const intro = "Welcome to E-Commerce! We're very excited to have you on board."
        const instructions = 'To get started with E-Commerce, Following are you credentials:'

        const mailGenerator = new Mailgen({
            theme: 'default',
            product: {
                name: 'E-Commerce',
                link: 'https://mailgen.js/'
            }
        });

        const response = {
            body: {
                signature: false,
                // greeting: false,
                name: 'Dear Customer',
                intro: intro,
                action: {
                    instructions: instructions,
                    button: {
                        color: '#22BC66',
                        text: `Email: ${email} PASS: ${otp}`
                    }
                }
            }
        };

        const mail = mailGenerator.generate(response);
        
        return await sendEmail(email, subject, mail, otp);
    } catch (error) {
        console.error('Error generating email:', error.message);

        return {
            success: false,
            message: 'Error generating Email',
            error: error.message,
        };
    }
};

module.exports = {
    sendEmail,
    sendOTP,
    generateOTP,
    sendCreds
};
