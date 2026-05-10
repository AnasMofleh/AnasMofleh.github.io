from data_writer import data_writer
import requests
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

    def list_repos(self):
        projects = {}
        tags = {}
        page = 1

        while True:
            # GitHub API URL for the user's repositories
            url = f'https://api.github.com/users/{self.username}/repos'

            # Send a GET request to the GitHub API with authorization
            try:
                response = requests.get(
                    url,
                    headers={'Authorization': f'token {self.token}'},
                    params={'per_page': 100, 'page': page}
                )
                response.raise_for_status()
            except requests.exceptions.RequestException as error:
                status = getattr(error, 'response', None)
                status_code = status.status_code if status else 'N/A'
                print(f'Error fetching repositories (HTTP {status_code}): {error}')
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




