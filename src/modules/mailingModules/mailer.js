// Konfiguracja nodemailer
const nodemailer = require('nodemailer');
const logger = require('../../logger');

// Konfiguracja transportera email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


// Test połączenia z serwerem email
 async function testConnection() {
  try {
    await transporter.verify();
    logger.info('Połączenie z serwerem email powiodło się');
    return true;
  } catch (error) {
    logger.error(`Nie udało się połączyć z serwerem email: ${error.message}`);
    return false;
  }
};

async function sendEmail(to, subject, html) {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent', { to, messageId: info.messageId });
    return info;
  } catch (error) {
    logger.error('Failed to send email', { to, error: error.message });
    throw error;
  }
}

module.exports = {
  testConnection,
  sendEmail,
  transporter
};
