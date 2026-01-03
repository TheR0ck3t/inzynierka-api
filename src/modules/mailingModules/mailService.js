// Główny serwis mailingowy - funkcje biznesowe
const { sendEmail } = require('./mailer');
const { welcomeTemplate, passwordResetTemplate, accountDeactivatedTemplate } = require('./templates/userTemplates');
const logger = require('../../logger');

class MailService {
  // Wysłanie emaila powitalnego po utworzeniu konta
  static async sendWelcomeEmail(email, firstName, lastName, tempPassword) {
    try {
      const template = welcomeTemplate(firstName, lastName, tempPassword);
      
      const result = await sendEmail(email, template.subject, template.html);
      
      logger.info('Welcome email sent', {
        to: email,
        messageId: result.messageId,
        preview: result.preview
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to send welcome email', {
        to: email,
        error: error.message
      });
      throw error;
    }
  }

  // Wysłanie emaila z resetem hasła
  static async sendPasswordResetEmail(email, firstName, lastName, resetToken) {
    try {
      const template = passwordResetTemplate(firstName, lastName, resetToken);
      
      const result = await sendEmail(email, template.subject, template.html);
      
      logger.info('Password reset email sent', {
        to: email,
        messageId: result.messageId
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to send password reset email', {
        to: email,
        error: error.message
      });
      throw error;
    }
  }

  // Powiadomienie o dezaktywacji konta
  static async sendAccountDeactivatedEmail(email, firstName, lastName, reason = null) {
    try {
      const template = accountDeactivatedTemplate(firstName, lastName, reason);
      
      const result = await sendEmail(email, template.subject, template.html);
      
      logger.info('Account deactivated email sent', {
        to: email,
        messageId: result.messageId
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to send account deactivated email', {
        to: email,
        error: error.message
      });
      throw error;
    }
  }

  // Ogólna funkcja do wysyłania powiadomień
  static async sendNotification(email, subject, message, type = 'info') {
    try {
      const colors = {
        info: '#17a2b8',
        success: '#28a745', 
        warning: '#ffc107',
        error: '#dc3545'
      };

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${colors[type]}20; padding: 20px; text-align: center; border-left: 4px solid ${colors[type]};">
            <h1 style="color: ${colors[type]};">${subject}</h1>
          </div>
          <div style="padding: 30px 20px;">
            <p>${message}</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 14px;">
              System GAR - ${new Date().toLocaleDateString('pl-PL')}
            </p>
          </div>
        </div>
      `;

      const result = await sendEmail(email, subject, html);
      
      logger.info('Notification email sent', {
        to: email,
        subject: subject,
        type: type,
        messageId: result.messageId
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to send notification email', {
        to: email,
        subject: subject,
        error: error.message
      });
      throw error;
    }
  }

  // Test wysyłania emaila
  static async sendTestEmail(email) {
    try {
      return await this.sendNotification(
        email,
        'Test email - System GAR',
        'To jest testowa wiadomość email. Jeśli ją otrzymałeś, konfiguracja email działa poprawnie!',
        'success'
      );
    } catch (error) {
      throw error;
    }
  }
}

module.exports = MailService;
