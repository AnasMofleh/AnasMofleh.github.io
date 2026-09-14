from data_writer import data_writer
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import os
import sys


class projects_getter():
    def __init__(self):
        username = os.environ.get("GH_USERNAME")
        token = os.environ.get("GH_TOKEN")
        if not username or not token:
            print("Error: GH_USERNAME and GH_TOKEN environment variables must be set.")
            sys.exit(1)
        self.username = username
        self.token = token
        self.session = self._make_session()

    def _make_session(self):
        retries = Retry(
            total=4,
            backoff_factor=2,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET",),
            respect_retry_after_header=True,
        )
        session = requests.Session()
        session.mount("https://", HTTPAdapter(max_retries=retries))
        return session

    def _fetch_page(self, page, authenticated=True):
        # GitHub API URL for the user's repositories
        url = f'https://api.github.com/users/{self.username}/repos'
        headers = {'Authorization': f'token {self.token}'} if authenticated else {}
        return self.session.get(
            url,
            headers=headers,
            params={'per_page': 100, 'page': page},
            timeout=(5, 30),
        )

    def list_repos(self):
        projects = {}
        tags = {}
        page = 1
        authenticated = True

        while True:
            try:
                response = self._fetch_page(page, authenticated=authenticated)

                # GITHUB_TOKEN may be rejected for user-scoped endpoints; public
                # repo data needs no auth, so fall back to an anonymous request.
                if (authenticated
                        and response.status_code == 403
                        and 'resource not accessible by integration' in response.text.lower()):
                    print('GITHUB_TOKEN not accepted for this endpoint; '
                          'retrying without authentication (public data only).')
                    authenticated = False
                    response = self._fetch_page(page, authenticated=False)

                response.raise_for_status()
            except requests.exceptions.HTTPError as error:
                status_code = error.response.status_code
                hints = {
                    401: 'the token is invalid or has expired',
                    403: 'the token lacks permission or the rate limit is exceeded'
                         f' (X-RateLimit-Remaining: {error.response.headers.get("X-RateLimit-Remaining", "N/A")})',
                    404: f'the user "{self.username}" was not found',
                }
                print(f'Error fetching repositories (HTTP {status_code}): '
                      f'{hints.get(status_code, "")} — {error}')
                sys.exit(1)
            except requests.exceptions.RequestException as error:
                print(f'Network error fetching repositories after retries: {error}')
                sys.exit(1)

            repos = response.json()
            if not isinstance(repos, list):
                print(f'Unexpected API response: {repos}')
                sys.exit(1)

            if not repos:
                break

            # Extract repository details
            for repo in repos:
                projects[repo['name']] = {
                    'name': repo['name'],
                    'logo': f'https://github.com/{self.username}/{repo["name"]}/blob/main/thumbnail.png?raw=true',
                    'repo': repo['html_url'],
                    'summary': repo['description'],
                    'tags': repo['topics']
                }

                for t in repo['topics']:
                    tags.update({t.lower(): {'name': t.capitalize(), 'filter': t}})

            page += 1

        return projects, tags


if __name__ == '__main__':
    projects, tags = projects_getter().list_repos()
    data_writer().update_info(tags, 'data/en/sections/projects.yaml', 'buttons')
    data_writer().update_info(projects, 'data/en/sections/projects.yaml', 'projects')
