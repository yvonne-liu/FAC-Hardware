const qs = require('querystring');
const request = require('request');

const { parallel, partial } = require('./../lib/utilities');

module.exports = {
  method: 'GET',
  path: '/login',
  config: {
    auth: false,
  },
  handler: (req, reply) => {
    const queryParamAccessToken = {
      code: req.url.query.code,
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
    };
    const accessTokenPath = 'https://github.com/login/oauth/access_token?';

    const accessTokenUrl = accessTokenPath + qs.stringify(queryParamAccessToken);

    request.post(accessTokenUrl, (err, response, githubAccessTokenResponse) => {
      if (err) {
        return reply.view('error', { error: 'Error connecting to Github API.' });
      }

      const { access_token } = qs.parse(githubAccessTokenResponse);
      if (!access_token) {
        return reply.view('error', { error: 'We didn\'t get an access token from Github, sorry!' });
      }

      const headers = {
        'User-Agent': 'fac-apps',
        Authorization: `token ${access_token}`,
      };

      const userUrl = 'https://api.github.com/user';
      const orgsUrl = 'https://api.github.com/user/orgs';

      const requestUser = partial(request.get, { url: userUrl, headers });
      const requestOrgs = partial(request.get, { url: orgsUrl, headers });

      parallel([requestOrgs, requestUser], (err, [orgs, user]) => {
        if (err) {
          return reply.view('error', { error: 'Invalid response from Github.' });
        }

        const userInfo = JSON.parse(user[1]);
        const orgsInfo = JSON.parse(orgs[1]);
        const facOrgId = 9970257;
        const isFacMember = orgsInfo.find(org => org.id === facOrgId);

        if (isFacMember) {
          req.cookieAuth.set({
            name: userInfo.name,
            avatar: userInfo.avatar_url,
          });
          return reply.redirect('/landing');
        }

        return reply.view('error', { error: 'You\'re not allowed here.' });
      });
    });
  },
};
