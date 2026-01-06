// Szablony emaili dla użytkowników

const welcomeTemplate = (firstName, lastName, tempPassword, verification_token) => {
  return {
    subject: 'Witamy w systemie GAR - Twoje konto zostało utworzone',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #343a40;">Witamy w systemie GAR</h1>
        </div>
        
        <div style="padding: 30px 20px;">
          <h2>Cześć ${firstName} ${lastName}!</h2>
          
          <p>Twoje konto w systemie GAR zostało pomyślnie utworzone. Oto Twoje dane logowania:</p>
          
          <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Hasło tymczasowe:</strong> <code style="background-color: #fff; padding: 5px; border-radius: 3px;">${tempPassword}</code></p>
          </div>
          
          <p><strong>Ważne:</strong> Ze względów bezpieczeństwa, zalecamy zmianę hasła po pierwszym logowaniu.</p>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${process.env.BACKEND_URL || 'http://localhost:5123'}/api/auth/verify/email?token=${verification_token}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Zweryfikuj email i aktywuj konto
            </a>
          </div>
          
          <p>Po weryfikacji będziesz mógł zalogować się do systemu.</p>
          
          <p>Jeśli masz pytania, skontaktuj się z administratorem systemu.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
          <p style="color: #6c757d; font-size: 14px;">
            To jest automatyczna wiadomość. Prosimy nie odpowiadać na ten email.
          </p>
        </div>
      </div>
    `
  };
};

const passwordResetTemplate = (firstName, lastName, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  
  return {
    subject: 'Reset hasła - System GAR',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #fff3cd; padding: 20px; text-align: center; border-left: 4px solid #ffc107;">
          <h1 style="color: #856404;">Reset hasła</h1>
        </div>
        
        <div style="padding: 30px 20px;">
          <h2>Cześć ${firstName} ${lastName}!</h2>
          
          <p>Otrzymaliśmy prośbę o reset hasła dla Twojego konta w systemie GAR.</p>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${resetUrl}" 
               style="background-color: #ffc107; color: #212529; padding: 12px 30px; text-decoration: none; border-radius: 5px;">
              Zresetuj hasło
            </a>
          </div>
          
          <p><strong>Link jest ważny przez 1 godzinę.</strong></p>
          
          <p>Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
          <p style="color: #6c757d; font-size: 14px;">
            Jeśli przycisk nie działa, skopiuj ten link: <br>
            <code>${resetUrl}</code>
          </p>
        </div>
      </div>
    `
  };
};

const accountDeactivatedTemplate = (firstName, lastName, reason) => {
  return {
    subject: 'Twoje konto zostało dezaktywowane - System GAR',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8d7da; padding: 20px; text-align: center; border-left: 4px solid #dc3545;">
          <h1 style="color: #721c24;">Konto dezaktywowane</h1>
        </div>
        
        <div style="padding: 30px 20px;">
          <h2>Cześć ${firstName} ${lastName}!</h2>
          
          <p>Informujemy, że Twoje konto w systemie GAR zostało dezaktywowane.</p>
          
          ${reason ? `<p><strong>Powód:</strong> ${reason}</p>` : ''}
          
          <p>Jeśli uważasz, że to pomyłka lub masz pytania, skontaktuj się z administratorem systemu.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
          <p style="color: #6c757d; font-size: 14px;">
            To jest automatyczna wiadomość. Prosimy nie odpowiadać na ten email.
          </p>
        </div>
      </div>
    `
  };
};

module.exports = {
  welcomeTemplate,
  passwordResetTemplate,
  accountDeactivatedTemplate
};
