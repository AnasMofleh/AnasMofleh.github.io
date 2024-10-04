from data_writer import data_writer
import requests
import os 



class projects_getter():
    def __init__(self):
        self.username = os.environ["GH_USERNAME"]
        self.token = os.environ["GH_TOKEN"]

    def list_repos(self):
        try:
            # GitHub API URL for the user's repositories
            url = f'https://api.github.com/users/{self.username}/repos'
        
            # Send a GET request to the GitHub API with authorization
            response = requests.get(url, headers={'Authorization': f'token {self.token}'})

            projects = {}
            # Extract repository details
            tags = {}
            for repo in response.json():
                projects[repo['name']] = {
                    'name': repo['name'],
                    'logo': f'https://github.com/{self.username}/{repo["name"]}/blob/main/thumbnail.png?raw=true',
                    #'role' : 'Owner',  # GitHub API does not provide role information directly
                    #'timeline' : repo['created_at'],
                    'repo' : repo['html_url'],
                    #'url' : repo['html_url'],
                    'summary': repo['description'],
                    'tags' : repo['topics']
                }

                for t in repo['topics']:
                    tags.update({t.lower(): {'name': t.capitalize(), 'filter': t}})

            return projects, tags

        except requests.exceptions.RequestException as error:
            print(f'Error fetching repositories: {error}')


if __name__ == '__main__':
    projects, tags  = projects_getter().list_repos()
    data_writer().update_info(tags, 'data\en\sections\projects.yaml', 'buttons')
    data_writer().update_info(projects, 'data\en\sections\projects.yaml', 'projects')




