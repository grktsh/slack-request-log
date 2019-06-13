const querystring = require('querystring');
const IncomingWebhook = require('@slack/client').IncomingWebhook;
const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);

exports.slackRequestLog = data => {
  const logEntry = JSON.parse(new Buffer(data.data, 'base64').toString());
  const message = createSlackMessage(logEntry);
  return webhook.send(message);
};

const createSlackMessage = logEntry => {
  const { httpRequest, protoPayload: requestLog } = logEntry;
  const logUrl =
    'https://console.cloud.google.com/logs/viewer?' +
    querystring.stringify({
      project: process.env.GCP_PROJECT,
      dateRangeStart: logEntry.timestamp,
      dateRangeEnd: new Date().toISOString(),
      interval: 'CUSTOM',
      logName: logEntry.logName,
      resource: logEntry.resource.type,
      filters: `request_id:${requestLog.requestId}`
    });

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `<${logUrl}|${logEntry.timestamp}>\n` +
          `${requestLog.method} ${requestLog.resource}`
      },
      fields: [
        {
          type: 'mrkdwn',
          text: `*Severity* ${logEntry.severity}`
        },
        {
          type: 'mrkdwn',
          text: `*Status* ${httpRequest.status}`
        },
        {
          type: 'mrkdwn',
          text: `*Service* ${logEntry.resource.labels.module_id}`
        },
        {
          type: 'mrkdwn',
          text: `*Version* ${logEntry.resource.labels.version_id}`
        }
      ]
    }
  ];

  if (requestLog.line && requestLog.line.length) {
    const logLineSeverities = [
      'WARNING',
      'ERROR',
      'CRITICAL',
      'ALERT',
      'EMERGENCY'
    ];
    const logLines = requestLog.line.filter(logLine => {
      return logLineSeverities.includes(logLine.severity);
    });

    if (logLines.length) {
      blocks.push(
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'plain_text',
            text: logLines[logLines.length - 1].logMessage.slice(0, 100)
          }
        }
      );
    }
  }
  return { blocks };
};
