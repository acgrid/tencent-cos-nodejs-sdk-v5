var http = require('http');
var STS = require('qcloud-cos-sts');
var COS = require('../index');

var config = {
  SecretId: process.env.SecretId || '',
  SecretKey: process.env.SecretKey || '',
  Bucket: process.env.Bucket || '',
  Region: process.env.Region || '',
};

var port = Number(process.env.STS_PORT || 3000);
var host = process.env.STS_HOST || '127.0.0.1';
var allowPrefix = process.env.STS_ALLOW_PREFIX || 'nodejs-sdk/test/';
var durationSeconds = Number(process.env.STS_DURATION_SECONDS || 7200);

var requiredKeys = ['SecretId', 'SecretKey', 'Bucket', 'Region'];
var missingKeys = requiredKeys.filter(function (key) {
  return !config[key];
});

if (missingKeys.length) {
  console.error('Missing COS env vars: ' + missingKeys.join(', '));
  process.exit(1);
}

var appIdMatch = config.Bucket.match(/-(\d+)$/);
if (!appIdMatch) {
  console.error('Bucket must be the full COS bucket name, for example test-1250000000');
  process.exit(1);
}

var AppId = appIdMatch[1];
var cos = new COS({
  SecretId: config.SecretId,
  SecretKey: config.SecretKey,
});

function writeJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function writeError(res, statusCode, err) {
  writeJson(res, statusCode, {
    error: err && err.message ? err.message : String(err),
  });
}

function getStsPolicy() {
  return {
    version: '2.0',
    statement: [
      {
        action: [
          'name/cos:PutObject',
          'name/cos:PostObject',
          'name/cos:InitiateMultipartUpload',
          'name/cos:ListMultipartUploads',
          'name/cos:ListParts',
          'name/cos:UploadPart',
          'name/cos:CompleteMultipartUpload',
        ],
        effect: 'allow',
        principal: { qcs: ['*'] },
        resource: ['qcs::cos:' + config.Region + ':uid/' + AppId + ':' + config.Bucket + '/' + allowPrefix + '*'],
      },
    ],
  };
}

function handleSts(res) {
  STS.getCredential(
    {
      secretId: config.SecretId,
      secretKey: config.SecretKey,
      policy: getStsPolicy(),
      durationSeconds: durationSeconds,
      region: config.Region,
    },
    function (err, data) {
      if (err) return writeError(res, 500, err);
      writeJson(res, 200, data);
    }
  );
}

function handleUploadSign(res) {
  try {
    writeJson(res, 200, {
      signMap: {
        PutObject: cos.getAuth({
          Bucket: config.Bucket,
          Region: config.Region,
          Method: 'PUT',
          Key: '1.txt',
          Expires: 900,
        }),
      },
    });
  } catch (err) {
    writeError(res, 500, err);
  }
}

var server = http.createServer(function (req, res) {
  var pathname = new URL(req.url, 'http://' + req.headers.host).pathname;

  if (req.method !== 'GET') {
    return writeError(res, 405, 'Method not allowed');
  }

  if (pathname === '/sts') {
    return handleSts(res);
  }

  if (pathname === '/uploadSign') {
    return handleUploadSign(res);
  }

  if (pathname === '/health') {
    return writeJson(res, 200, { ok: true });
  }

  writeError(res, 404, 'Not found');
});

server.on('error', function (err) {
  console.error('COS STS test server failed: ' + err.message);
  process.exit(1);
});

server.listen(port, host, function () {
  console.log('COS STS test server listening at http://' + host + ':' + port);
  console.log('Use env: nodejssdkStsUrl=http://' + host + ':' + port);
});
