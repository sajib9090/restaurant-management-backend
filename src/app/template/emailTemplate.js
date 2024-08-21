export const emailTemplate = (otp) => {
  return `
         <div
    	style="font-family: Arial, sans-serif; line-height: 1.8; color: #444; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #ddd; border-radius: 8px;">
    	<p style="font-size: 16px; color: #333;">Thank you for registering with us! To complete your account creation,
    		please verify your email address using the One-Time Password (OTP) provided below.</p>

    	<div
    		style="background-color: #f9f9f9; padding: 25px; margin: 20px 0; border-radius: 10px; text-align: center; border: 1px solid #eee;">
    		<p style="font-size: 20px; font-weight: 600; color: #00796b; margin-bottom: 5px;">Your OTP is:</p>
    		<p style="font-size: 42px; font-weight: 700; color: #E7D71B; margin: 0;">${otp}</p>
    	</div>

    	<p style="font-size: 16px; color: #333;">This OTP is valid for <strong>5 minutes</strong>. Please enter it on the
    		verification page to activate your account.</p>
    	<p style="font-size: 16px; color: #333;">If you did not request this, please ignore this email.</p>

    	<p style="font-size: 16px; margin-top: 25px; color: #333;">Best regards,</p>
    	<p style="font-size: 16px; font-weight: 600; color: #333;">The Ahaar Assist Team</p>

    	<hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

    	<p style="font-size: 12px; color: #888; text-align: center;">If you have any questions, feel free to contact our
    		support team at <a href="mailto:support@yourcompany.com"
    			style="color: #001529; text-decoration: none;">support@yourcompany.com</a>.</p>
    </div>
    
    `;
};
