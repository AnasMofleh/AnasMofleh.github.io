from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from data_writer import data_writer
import asyncio
import time
import re
import os


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless = False)
        
        # create a new incognito browser context.
        context = await browser.new_context(locale='en-US')

        page = await context.new_page()

        # Navigate to LinkedIn login page
        await page.goto('https://www.linkedin.com/login')

        # Enter login credentials
        await page.get_by_label('Email or Phone').fill(os.environ["LINKEDIN_EMAIL"])  # Replace with your LinkedIn email locally 
        await page.get_by_label('Password').fill(os.environ["LINKEDIN_PASSWORD"])     # Replace with your LinkedIn password locally
        
        #   // Click the login button
        await page.get_by_role('button', name="Sign in", exact=True).click() 
     
        #   wait 30 seconds in case of 2 factor auth
        time.sleep(10)

        # Navigate to LinkedIn certifications section
        await page.goto('https://www.linkedin.com/in/anas-mofleh/details/certifications/', wait_until='domcontentloaded')       

        time.sleep(10)

        # get the html content of the page
        content = await page.content()

        # create a BeautifulSoup object
        soup = BeautifulSoup(content, 'html.parser')

        # create an empty dict
        cert_list = {}

        # finding parent <ul> tag
        certs = soup.find('div', attrs={'class': 'scaffold-finite-scroll__content'}).ul.find_all("li", recursive=False) 

        for cert in certs:
            root = cert.div.div.find_all('div', recursive=False)[1]
            try:
                name = re.sub("\s+", ' ', root.div.a.div.div.div.div.span.get_text(strip=True))
            except: name = 'cert'

            try:
                company = re.sub("\s+", ' ', root.div.a.find_all('span', recursive=False)[0].span.get_text(strip=True))
            except: company = 'company'

            try:
                issuedDate = re.sub("\s+", ' ', root.div.a.find_all('span', recursive=False)[1].span.get_text(strip=True))
            except: issuedDate = 'issuedDate'

            try:
                url = re.sub("\s+", ' ', root.find_all('div', recursive=False)[1].ul.li.div.div.a.get("href"))
            except: url = 'url'

            try:
                thumbnail = re.sub("\s+", ' ', cert.find('img', class_= 'pvs-thumbnail__image evi-image lazy-image ember-view').get("src"))
            except: thumbnail = 'thumbnail'

            try:
                logo = re.sub("\s+", ' ', cert.div.div.div.a.div.div.img.get("src"))
            except: logo = 'logo'


            cert_list[name] = {
                 'name': name,
                 'company': company, 
                 'issuedDate': issuedDate, 
                 'url': url, 
                 'thumbnail': thumbnail,
                 'logo': logo
                 }
            
        # for debugging
        #print(json.dumps(cert_list, indent=4, ensure_ascii=False))

        data_writer().update_info(cert_list, 'data/en/sections/skills.yaml', 'skills')
        
        # gracefully close up everything
        await context.close()
        await browser.close()


asyncio.run(main())
