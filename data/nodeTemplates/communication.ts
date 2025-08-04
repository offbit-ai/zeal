import { NodeTemplate } from './types'

/**
 * Communication Node Templates
 */
export const communicationTemplates: NodeTemplate[] = [
  {
    "id": "tpl_email_sender",
    "type": "communication",
    "title": "Email Sender",
    "subtitle": "Send Email Messages",
    "category": "communication",
    "subcategory": "email",
    "description": "Send emails via SMTP or email service providers",
    "icon": "mail",
    "variant": "blue-600",
    "shape": "rectangle",
    "size": "medium",
    "ports": [
      {
        "id": "content-in",
        "label": "Content",
        "type": "input",
        "position": "left"
      },
      {
        "id": "recipients-in",
        "label": "Recipients",
        "type": "input",
        "position": "top"
      },
      {
        "id": "sent-out",
        "label": "Sent",
        "type": "output",
        "position": "right"
      },
      {
        "id": "failed-out",
        "label": "Failed",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "provider": {
        "type": "select",
        "options": [
          "smtp",
          "sendgrid",
          "mailgun",
          "ses"
        ],
        "defaultValue": "smtp"
      },
      "subject": {
        "type": "text",
        "required": true,
        "placeholder": "Email subject"
      },
      "fromEmail": {
        "type": "text",
        "required": true,
        "placeholder": "sender@example.com"
      },
      "fromName": {
        "type": "text",
        "placeholder": "Sender Name"
      },
      "templateEngine": {
        "type": "select",
        "options": [
          "none",
          "handlebars",
          "mustache"
        ],
        "defaultValue": "none"
      }
    },
    "requiredEnvVars": [
      "SMTP_HOST",
      "SMTP_USER",
      "SMTP_PASSWORD"
    ],
    "tags": [
      "email",
      "communication",
      "smtp",
      "notification"
    ],
    "version": "1.0.0",
    "isActive": true,
    "propertyRules": {
      "triggers": [
        "provider",
        "templateEngine"
      ],
      "rules": [
        {
          "when": "$.provider == 'smtp'",
          "updates": {
            "title": "SMTP Email",
            "subtitle": "Direct SMTP",
            "description": "Send emails via SMTP server",
            "requiredEnvVars": ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"]
          }
        },
        {
          "when": "$.provider == 'sendgrid'",
          "updates": {
            "title": "SendGrid Email",
            "subtitle": "Cloud Email Service",
            "description": "Send emails via SendGrid API",
            "requiredEnvVars": ["SENDGRID_API_KEY"]
          }
        },
        {
          "when": "$.provider == 'mailgun'",
          "updates": {
            "title": "Mailgun Email",
            "subtitle": "Email API Service",
            "description": "Send emails via Mailgun API",
            "requiredEnvVars": ["MAILGUN_API_KEY", "MAILGUN_DOMAIN"]
          }
        },
        {
          "when": "$.provider == 'ses'",
          "updates": {
            "title": "Amazon SES",
            "subtitle": "AWS Email Service",
            "description": "Send emails via Amazon SES",
            "requiredEnvVars": ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"]
          }
        }
      ]
    }
  },
  {
    "id": "tpl_discord_webhook",
    "type": "communication",
    "title": "Discord Webhook",
    "subtitle": "Send Discord Messages",
    "category": "communication",
    "subcategory": "messaging",
    "description": "Send messages to Discord channels",
    "icon": "message-circle",
    "variant": "black",
    "shape": "circle",
    "size": "medium",
    "ports": [
      {
        "id": "message-in",
        "label": "Message",
        "type": "input",
        "position": "left"
      },
      {
        "id": "embed-in",
        "label": "Embed",
        "type": "input",
        "position": "top"
      },
      {
        "id": "sent-out",
        "label": "Sent",
        "type": "output",
        "position": "right"
      }
    ],
    "properties": {
      "username": {
        "type": "text",
        "placeholder": "Workflow Bot"
      },
      "avatarUrl": {
        "type": "text",
        "placeholder": "https://example.com/avatar.png"
      },
      "tts": {
        "type": "boolean",
        "defaultValue": false
      },
      "embedColor": {
        "type": "text",
        "placeholder": "#7289DA"
      }
    },
    "requiredEnvVars": [
      "DISCORD_WEBHOOK_URL"
    ],
    "tags": [
      "discord",
      "webhook",
      "chat",
      "gaming"
    ],
    "version": "1.0.0",
    "isActive": true
  },
  {
    "id": "tpl_facebook_post",
    "type": "social",
    "title": "Facebook Post",
    "subtitle": "Post to Facebook",
    "category": "communication",
    "subcategory": "messaging",
    "description": "Create posts on Facebook pages",
    "icon": "facebook",
    "variant": "blue-600",
    "shape": "circle",
    "size": "medium",
    "ports": [
      {
        "id": "content-in",
        "label": "Content",
        "type": "input",
        "position": "left"
      },
      {
        "id": "media-in",
        "label": "Media",
        "type": "input",
        "position": "top"
      },
      {
        "id": "post-out",
        "label": "Post",
        "type": "output",
        "position": "right"
      },
      {
        "id": "insights-out",
        "label": "Insights",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "pageId": {
        "type": "text",
        "required": true,
        "placeholder": "Facebook Page ID"
      },
      "scheduling": {
        "type": "boolean",
        "defaultValue": false
      },
      "publishTime": {
        "type": "text",
        "placeholder": "2024-12-25T10:00:00Z"
      },
      "targeting": {
        "type": "textarea",
        "placeholder": "{ \"countries\": [\"US\", \"CA\"] }"
      }
    },
    "requiredEnvVars": [
      "FACEBOOK_ACCESS_TOKEN"
    ],
    "tags": [
      "facebook",
      "social",
      "meta",
      "marketing"
    ],
    "version": "1.0.0",
    "isActive": true
  },
  {
    "id": "tpl_linkedin_post",
    "type": "social",
    "title": "LinkedIn Post",
    "subtitle": "Share on LinkedIn",
    "category": "communication",
    "subcategory": "messaging",
    "description": "Share content on LinkedIn",
    "icon": "linkedin",
    "variant": "blue-600",
    "shape": "circle",
    "size": "medium",
    "ports": [
      {
        "id": "content-in",
        "label": "Content",
        "type": "input",
        "position": "left"
      },
      {
        "id": "article-in",
        "label": "Article",
        "type": "input",
        "position": "top"
      },
      {
        "id": "share-out",
        "label": "Share",
        "type": "output",
        "position": "right"
      },
      {
        "id": "analytics-out",
        "label": "Analytics",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "visibility": {
        "type": "select",
        "options": [
          "anyone",
          "connections",
          "logged_in"
        ],
        "defaultValue": "anyone"
      },
      "shareType": {
        "type": "select",
        "options": [
          "share",
          "article",
          "image",
          "video"
        ],
        "defaultValue": "share"
      },
      "companyId": {
        "type": "text",
        "placeholder": "Company page ID (optional)"
      }
    },
    "requiredEnvVars": [
      "LINKEDIN_ACCESS_TOKEN"
    ],
    "tags": [
      "linkedin",
      "social",
      "professional",
      "business"
    ],
    "version": "1.0.0",
    "isActive": true
  },
  {
    "id": "tpl_slack_webhook",
    "type": "communication",
    "title": "Slack Webhook",
    "subtitle": "Send Slack Messages",
    "category": "communication",
    "subcategory": "messaging",
    "description": "Send messages to Slack channels via webhook",
    "icon": "message-square",
    "variant": "gray-800",
    "shape": "circle",
    "size": "medium",
    "ports": [
      {
        "id": "message-in",
        "label": "Message",
        "type": "input",
        "position": "left"
      },
      {
        "id": "sent-out",
        "label": "Sent",
        "type": "output",
        "position": "right"
      },
      {
        "id": "error-out",
        "label": "Error",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "channel": {
        "type": "text",
        "placeholder": "#general"
      },
      "username": {
        "type": "text",
        "placeholder": "Workflow Bot"
      },
      "iconEmoji": {
        "type": "text",
        "placeholder": ":robot_face:"
      },
      "messageType": {
        "type": "select",
        "options": [
          "plain",
          "markdown",
          "blocks"
        ],
        "defaultValue": "markdown"
      }
    },
    "requiredEnvVars": [
      "SLACK_WEBHOOK_URL"
    ],
    "tags": [
      "slack",
      "webhook",
      "chat",
      "notification"
    ],
    "version": "1.0.0",
    "isActive": true
  },
  {
    "id": "tpl_twitter_post",
    "type": "social",
    "title": "Twitter/X Post",
    "subtitle": "Post to Twitter/X",
    "category": "communication",
    "subcategory": "messaging",
    "description": "Post tweets to Twitter/X",
    "icon": "twitter",
    "variant": "blue-600",
    "shape": "circle",
    "size": "medium",
    "ports": [
      {
        "id": "content-in",
        "label": "Content",
        "type": "input",
        "position": "left"
      },
      {
        "id": "media-in",
        "label": "Media",
        "type": "input",
        "position": "top"
      },
      {
        "id": "tweet-out",
        "label": "Tweet",
        "type": "output",
        "position": "right"
      },
      {
        "id": "metrics-out",
        "label": "Metrics",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "replyTo": {
        "type": "text",
        "placeholder": "Tweet ID to reply to"
      },
      "sensitive": {
        "type": "boolean",
        "defaultValue": false
      },
      "geo": {
        "type": "textarea",
        "placeholder": "{ \"lat\": 37.7749, \"long\": -122.4194 }"
      },
      "pollOptions": {
        "type": "textarea",
        "placeholder": "Option 1\nOption 2\nOption 3"
      }
    },
    "requiredEnvVars": [
      "TWITTER_API_KEY",
      "TWITTER_API_SECRET",
      "TWITTER_ACCESS_TOKEN",
      "TWITTER_ACCESS_SECRET"
    ],
    "tags": [
      "twitter",
      "social",
      "tweet",
      "microblog"
    ],
    "version": "1.0.0",
    "isActive": true
  },
  {
    "id": "tpl_twilio_sms",
    "type": "communication",
    "title": "Twilio SMS",
    "subtitle": "Send SMS Messages",
    "category": "communication",
    "subcategory": "voice",
    "description": "Send SMS messages via Twilio",
    "icon": "smartphone",
    "variant": "gray-700",
    "shape": "rectangle",
    "size": "medium",
    "ports": [
      {
        "id": "message-in",
        "label": "Message",
        "type": "input",
        "position": "left"
      },
      {
        "id": "recipients-in",
        "label": "Recipients",
        "type": "input",
        "position": "top"
      },
      {
        "id": "sent-out",
        "label": "Sent",
        "type": "output",
        "position": "right"
      },
      {
        "id": "status-out",
        "label": "Status",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "fromNumber": {
        "type": "text",
        "required": true,
        "placeholder": "+1234567890"
      },
      "mediaUrl": {
        "type": "text",
        "placeholder": "https://example.com/image.jpg"
      },
      "statusCallback": {
        "type": "text",
        "placeholder": "https://example.com/webhook"
      },
      "maxPrice": {
        "type": "number",
        "step": 0.01,
        "placeholder": "0.10"
      }
    },
    "requiredEnvVars": [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN"
    ],
    "tags": [
      "sms",
      "twilio",
      "communication",
      "mobile"
    ],
    "version": "1.0.0",
    "isActive": true
  }
]
