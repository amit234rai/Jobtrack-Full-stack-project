import Mailgen from "mailgen";
import nodemailer from "nodemailer";
import { env, isEmailConfigured } from "../config/env.js";

const mailGenerator = new Mailgen({
  theme: "default",
  product: { name: "JobTrack", link: env.CLIENT_ORIGIN },
});

let transport = null;

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_SECURE,
      auth: { user: env.MAIL_USER, pass: env.MAIL_PASSWORD },
      pool: true,
    });
  }
  return transport;
}

async function sendMail({ to, subject, body }) {
  if (!isEmailConfigured) {
    console.log(`[mail] not configured — would send "${subject}" to ${to}`);
    return;
  }

  const content = { body };

  await getTransport().sendMail({
    from: env.MAIL_FROM,
    to,
    subject,
    text: mailGenerator.generatePlaintext(content),
    html: mailGenerator.generate(content),
  });
}

const BUTTON_COLOR = "#176b4d";

export function sendWelcomeEmail(to, name) {
  return sendMail({
    to,
    subject: "Welcome to JobTrack — your workspace is ready",
    body: {
      name,
      intro: "Welcome to JobTrack. Your personal application workspace is ready to use.",
      action: {
        instructions: "Start by adding the roles you are targeting, then move them through your pipeline.",
        button: { color: BUTTON_COLOR, text: "Open my workspace", link: env.CLIENT_ORIGIN },
      },
      outro: "JobTrack keeps you organized from saved role all the way to offer.",
    },
  });
}

export function sendPasswordResetOtp(to, name, otp) {
  return sendMail({
    to,
    subject: `${otp} is your JobTrack reset code`,
    body: {
      name,
      intro: "We received a request to reset the password on your JobTrack account.",
      action: {
        instructions: "Enter this code in JobTrack. It expires in 15 minutes and can only be used once:",
        button: { color: BUTTON_COLOR, text: otp, link: env.CLIENT_ORIGIN },
      },
      outro: "If you didn't request this, no action is needed — your current password still works.",
    },
  });
}

export function sendPasswordChangedEmail(to, name) {
  return sendMail({
    to,
    subject: "Your JobTrack password was changed",
    body: {
      name,
      intro: "Your JobTrack password was changed successfully.",
      action: {
        instructions: "If this was you, nothing further is needed.",
        button: { color: BUTTON_COLOR, text: "Sign in to JobTrack", link: env.CLIENT_ORIGIN },
      },
      outro: "Didn't change your password? Reset it immediately — this alert exists to help you catch exactly that.",
    },
  });
}

export function sendInterviewReminder({ to, name, role, company, round, scheduledAt, location }) {
  return sendMail({
    to,
    subject: `Interview reminder: ${company} — ${role}`,
    body: {
      name,
      intro: `You have an upcoming ${round} for ${role} at ${company}.`,
      table: {
        data: [
          {
            When: new Date(scheduledAt).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }),
            Where: location || "Not specified",
          },
        ],
      },
      outro: "Good luck — JobTrack has your pipeline covered.",
    },
  });
}
