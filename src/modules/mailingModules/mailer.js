// Konfiguracja nodemailer
const nodemailer = require('nodemailer');
const logger = require('../../logger');

// Konfiguracja transportera email
const createTransporter = () => {
  // Dla developmentu - użyj ethereal email lub gmail
  if (process.env.NODE_ENV === 'development') {
    return nodemailer.createTransporter({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.ETHEREAL_USER || 'millie66@ethereal.email',
        pass: process.env.ETHEREAL_PASS || '3VntcAUwHn1F9YfBAN'
      }
    });
  }

  // Dla produkcji - Gmail/SendGrid/AWS SES
  return nodemailer.createTransporter({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS // App password dla Gmail
    }
  });
};

// Funkcja wysyłania emaila
const sendEmail = async (to, subject, html, text = null) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'GAR System'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML dla text version
    };

    const info = await transporter.sendMail(mailOptions);
    
    logger.info(`Email sent to ${to}: ${subject} (${info.messageId})`);

    return {
      success: true,
      messageId: info.messageId,
      preview: process.env.NODE_ENV === 'development' ? nodemailer.getTestMessageUrl(info) : null
    };
    
  } catch (error) {
    logger.error(`Error sending email: ${error.message}`);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Test połączenia z serwerem email
const testConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Email server connection successful');
    return true;
  } catch (error) {
    logger.error(`Email server connection failed: ${error.message}`);
    return false;
  }
};

module.exports = {
  sendEmail,
  testConnection,
  createTransporter
};
