# Superjoin Hiring Assignment

### Welcome to Superjoin's hiring assignment! 🚀

### Objective
Build a solution that enables real-time synchronization of data between a Google Sheet and a specified database (e.g., MySQL, PostgreSQL). The solution should detect changes in the Google Sheet and update the database accordingly, and vice versa.

### Problem Statement
Many businesses use Google Sheets for collaborative data management and databases for more robust and scalable data storage. However, keeping the data synchronised between Google Sheets and databases is often a manual and error-prone process. Your task is to develop a solution that automates this synchronisation, ensuring that changes in one are reflected in the other in real-time.

### Requirements:
1. Real-time Synchronisation
  - Implement a system that detects changes in Google Sheets and updates the database accordingly.
   - Similarly, detect changes in the database and update the Google Sheet.
  2.	CRUD Operations
   - Ensure the system supports Create, Read, Update, and Delete operations for both Google Sheets and the database.
   - Maintain data consistency across both platforms.
   
### Optional Challenges (This is not mandatory):
1. Conflict Handling
- Develop a strategy to handle conflicts that may arise when changes are made simultaneously in both Google Sheets and the database.
- Provide options for conflict resolution (e.g., last write wins, user-defined rules).
    
2. Scalability: 	
- Ensure the solution can handle large datasets and high-frequency updates without performance degradation.
- Optimize for scalability and efficiency.

## Submission ⏰
The timeline for this submission is: **Next 2 days**

Some things you might want to take care of:
- Make use of git and commit your steps!
- Use good coding practices.
- Write beautiful and readable code. Well-written code is nothing less than a work of art.
- Use semantic variable naming.
- Your code should be organized well in files and folders which is easy to figure out.
- If there is something happening in your code that is not very intuitive, add some comments.
- Add to this README at the bottom explaining your approach (brownie points 😋)
- Use ChatGPT4o/o1/Github Co-pilot, anything that accelerates how you work 💪🏽. 

Make sure you finish the assignment a little earlier than this so you have time to make any final changes.

Once you're done, make sure you **record a video** showing your project working. The video should **NOT** be longer than 120 seconds. While you record the video, tell us about your biggest blocker, and how you overcame it! Don't be shy, talk us through, we'd love that.

We have a checklist at the bottom of this README file, which you should update as your progress with your assignment. It will help us evaluate your project.

- [x] My code’s working just fine! 🥳
- [x] I have recorded a video showing it working and embedded it in the README ▶️
- [x] I have tested all the normal working cases 😎
- [x] I have even solved some edge cases (brownie points) 💪
- [x] I added my very planned-out approach to the problem at the end of this README 📜

## Got Questions❓
Feel free to check the discussions tab, you might get some help there. Check out that tab before reaching out to us. Also, did you know, the internet is a great place to explore? 😛

We're available at techhiring@superjoin.ai for all queries. 

All the best ✨.

## Developer's Section

## Video
[<video width="600" controls>
  <source src="https://drive.google.com/file/d/1rLHAs-GkYMHJuVdpIJZp568cRdfu4jMq/view?usp=sharing" type="video/mp4">
  Your browser does not support the video tag.
</video>](https://drive.google.com/file/d/1rLHAs-GkYMHJuVdpIJZp568cRdfu4jMq/view?usp=drive_link)

# Approach

## 1. Data Ingestion and JSON File Processing

- **Upload JSON Files**: Users upload JSON files through the provided controllers. These files are ingested and processed to generate two JSON files: `sheets.json` and `sql.json`.
  - **`sheets.json`**: Represents the data structure and content for the Google Sheet.
  - **`sql.json`**: Defines the table schema and data rows for the MySQL database.

## 2. Google Sheet Creation and Automation

- **Create Google Sheet**: Using the Google Sheets API, a new Google Sheet is automatically created based on the data in `sheets.json`. Users receive the link to this sheet via email.
- **Store Sheet ID**: The sheet ID is saved for future reference and polling.

## 3. Polling and Update Detection

- **Detect Changes**: Since service accounts cannot create triggers, the system uses the Google Drive API to monitor changes based on timestamps. It polls the Google Sheet every 10 seconds (interval is adjustable) to detect updates.
- **Update Sheets Data**: When a new update is detected, the latest version of the sheet is fetched, and `sheets.json` is updated.

## 4. Format Conversion and Data Synchronization

- **Convert Sheets Data to SQL Format**: The updated `sheets.json` is converted to `sql.json` using a function called `sheet2sql`. This function transforms the sheet data into a structured format suitable for MySQL.
- **Update MySQL Database**: The `sql.json` is used to automatically create or update the MySQL table with the latest data, ensuring that the database reflects the most recent changes from the Google Sheet.

## 5. Deletion Operations

- **Delete Sheet and Table**: Both the Google Sheet and the corresponding MySQL table can be deleted using API calls. The system also handles the cleanup of associated files, such as `sheetId.json`.
