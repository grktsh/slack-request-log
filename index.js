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
      minLogLevel: 0,
      expandAll: false,
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
        text: `<${logUrl}|${logEntry.timestamp}> ${requestLog.method} ${
          requestLog.resource
        }`
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

  if (requestLog.line.length) {
    blocks.push({
      type: 'divider'
    });

    for (const line of requestLog.line) {
      blocks.push({
        type: 'section',
        text: {
          type: 'plain_text',
          text: line.logMessage
        }
      });
    }
  }
  return { blocks };
};
