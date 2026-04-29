import random
import yaml
import os
import re

SKILLS_YAML_PATH = 'data/en/sections/skills.yaml'
SKILLS_IMAGE_DIR = 'static/images/sections/skills'

# Map (company, cert_name_substring) -> folder_name for matching
# When adding a new cert, add its mapping here
CERT_FOLDER_MAP = {
    ('Snowflake', 'Data Engineering'): 'hands-on-essentials-data-engineering',
    ('Snowflake', 'Data Warehouse'): 'hands-on-essentials-data-warehouse',
    ('Snowflake', 'Data Lake'): 'hands-on-essentials-data-lake',
    ('Snowflake', 'Data Applications'): 'hands-on-essentials-data-applications',
    ('Snowflake', 'Data Sharing'): 'hands-on-essentials-data-sharing',
    ('Microsoft', 'Implement a lakehouse'): 'implement-a-lakehouse-in-microsoft-fabric',
    ('Microsoft', 'Implement a Real-Time Intelligence'): 'implement-real-time-intelligence-solution-fabric',
    ('Microsoft', 'Azure Fundamentals'): 'azure-fundamentals',
    ('Microsoft', 'Azure Data Engineer Associate'): 'azure-data-engineer-associate',
    ('Microsoft', 'Fabric Data Engineer Associate'): 'fabric-data-engineer-associate',
    ('Microsoft', 'Fabric Analytics Engineer Associate'): 'fabric-analytics-engineer-associate',
    ('Microsoft', 'AI Agents Hackathon'): 'ai-agents-hackathon',
    ('Microsoft', 'Azure AI Fundamentals'): 'azure-ai-fundamentals',
    ('Microsoft', 'Azure Data Fundamentals'): 'azure-data-fundamentals',
    ('Databricks', 'Lakehouse Fundamentals'): 'lakehouse-fundamentals',
    ('Databricks', 'Databricks Fundamentals'): 'databricks-fundamentals',
    ('Databricks', 'Data Engineer Associate'): 'certified-data-engineer-associate',
    ('dbt Labs', 'dbt Fundamentals'): 'dbt-fundamentals',
    ('GitHub', 'GitHub Actions'): 'github-actions',
    ('GitHub', 'GitHub Foundations'): 'github-foundations',
    ('Amazon Web Services (AWS)', 'Object Storage'): 'object-storage',
}

# Map company name to folder name
COMPANY_FOLDER_MAP = {
    'Snowflake': 'snowflake',
    'Microsoft': 'microsoft',
    'Databricks': 'databricks',
    'dbt Labs': 'dbt-labs',
    'GitHub': 'github',
    'Amazon Web Services (AWS)': 'aws',
}


def get_cert_folder(skill):
    """Find the matching folder for a skill entry."""
    company = skill['company']
    name = skill['name']

    for (c, keyword), folder in CERT_FOLDER_MAP.items():
        if c == company and keyword in name:
            return folder
    return None


def get_company_folder(company):
    """Get the company folder name."""
    return COMPANY_FOLDER_MAP.get(
        company, company.lower().replace(' ', '-').replace('(', '').replace(')', '')
    )


def main():
    with open(SKILLS_YAML_PATH, 'r', encoding='utf8') as f:
        data = yaml.safe_load(f)

    updated_count = 0

    for skill in data['skills']:
        company_folder = get_company_folder(skill['company'])
        cert_folder = get_cert_folder(skill)

        if cert_folder is None:
            print(f"  Skipped (no mapping): {skill['company']} - {skill['name']}")
            continue

        base_path = os.path.join(SKILLS_IMAGE_DIR, company_folder, cert_folder)
        thumbnail_file = os.path.join(base_path, 'thumbnail.png')
        logo_file = os.path.join(base_path, 'logo.png')

        if os.path.exists(thumbnail_file):
            skill['thumbnail'] = f'/images/sections/skills/{company_folder}/{cert_folder}/thumbnail.png'
            updated_count += 1
            print(f"  ✓ thumbnail: {skill['name']}")
        else:
            print(f"  ✗ No thumbnail.png in {company_folder}/{cert_folder}/ — skipped")

        if os.path.exists(logo_file):
            skill['logo'] = f'/images/sections/skills/{company_folder}/{cert_folder}/logo.png'
            print(f"  ✓ logo: {skill['name']}")
        else:
            print(f"  ✗ No logo.png in {company_folder}/{cert_folder}/ — skipped")

    # Shuffle the skills in random order
    random.shuffle(data['skills'])

    with open(SKILLS_YAML_PATH, 'w', encoding='utf8') as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    print(f'\nUpdated {updated_count} image path(s) across {len(data["skills"])} skills.')
    print('Skills order has been randomized.')


if __name__ == '__main__':
    main()