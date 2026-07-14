import os
import re
import subprocess
import sys
import json
import datetime
from collections import Counter, defaultdict

# Force stdout and stderr to use UTF-8 to prevent Windows terminal encoding crashes
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass  # Fallback for Python versions < 3.7

# List of your names and emails to identify your commits
USER_SIGNATURES = [
    '2902duy', 
    'duy2902', 
    'dyu2902', 
    'dyu', 
    'dqhfit',
    'tduy29.2k4@gmail.com', 
    '100993366+2902duy@users.noreply.github.com',
    'dqhf.it@gmail.com'
]

# Keywords to filter out unregistered AI bot emails/accounts
UNREGISTERED_AI_KEYWORDS = [
    'anthropic.com',  # noreply@anthropic.com (Claude)
    'google.com',     # noreply@google.com, antigravity@google.com (Gemini, Antigravity)
    'openai.com',     # noreply@openai.com, codex@openai.com (ChatGPT, Codex)
    'gemini',         # gemini-1.5-pro, gemini-3.5-flash, gemini-2.5-pro
    'codex',          # codex, gpt-5 codex
    'gpt-5',          # gpt-5
    'anomaly.co'      # opencode@anomaly.co
]

def is_user_author(author_name, author_email):
    """
    Checks if the commit author matches one of your user signatures.
    """
    name = author_name.lower()
    email = author_email.lower()
    return any(sig in name or sig in email for sig in USER_SIGNATURES)

def get_week_monday(timestamp):
    """
    Given a timestamp, returns the string date of the Monday of that week (YYYY-MM-DD).
    """
    dt = datetime.date.fromtimestamp(float(timestamp))
    monday = dt - datetime.timedelta(days=dt.weekday())
    return monday.strftime('%Y-%m-%d')

def parse_git_history(repo_path):
    """
    Runs git log --numstat to extract commit stats, co-authors, and additions/deletions.
    """
    contributors_data = defaultdict(lambda: {
        "commits": 0,
        "additions": 0,
        "deletions": 0,
        "history": defaultdict(int)
    })
    
    try:
        # Run git log with numstat to get file additions/deletions
        # Output format:
        # HASH|AuthorName|AuthorEmail|Timestamp
        # Commit message...
        # Co-authored-by...
        # 14      0       .gitignore
        result = subprocess.run(
            ['git', 'log', '--all', '--numstat', '--pretty=format:COMMIT:%H|%an|%ae|%at%n%B'],
            cwd=repo_path,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        if result.returncode != 0:
            return contributors_data

        coauthor_pattern = re.compile(r'(?i)Co-authored-by:\s*([^<]+)\s*<([^>]+)>')
        
        # Split output by "COMMIT:" to process each commit
        commits = result.stdout.split('COMMIT:')
        
        for commit in commits:
            commit = commit.strip()
            if not commit:
                continue
            
            lines = commit.splitlines()
            if not lines:
                continue
                
            header = lines[0]
            parts = header.split('|')
            if len(parts) < 4:
                continue
                
            author_name = parts[1].strip()
            author_email = parts[2].strip()
            timestamp = parts[3].strip()
            
            # Find the week start (Monday)
            week_start = get_week_monday(timestamp)
            
            # Identify co-authors in this commit's body
            commit_coauthors = []
            commit_additions = 0
            commit_deletions = 0
            
            # Read commit message body and numstats
            is_body = True
            for line in lines[1:]:
                line = line.strip()
                if not line:
                    continue
                
                # Check for co-author line
                match = coauthor_pattern.search(line)
                if match:
                    co_name = match.group(1).strip()
                    co_email = match.group(2).strip()
                    commit_coauthors.append((co_name, co_email))
                    continue
                
                # If we encounter a line starting with numbers or tab, it is a numstat
                parts_stat = line.split()
                if len(parts_stat) >= 2 and (parts_stat[0].isdigit() or parts_stat[0] == '-'):
                    add = parts_stat[0]
                    del_ = parts_stat[1]
                    if add.isdigit():
                        commit_additions += int(add)
                    if del_.isdigit():
                        commit_deletions += int(del_)
            
            # Check if this commit belongs to you (either as author, or as co-author)
            belongs_to_user = is_user_author(author_name, author_email)
            if not belongs_to_user:
                # Check if you are a co-author in this commit
                for name, email in commit_coauthors:
                    if is_user_author(name, email):
                        belongs_to_user = True
                        break
            
            # We ONLY process commits that belong to you (where you are author or co-author)
            if belongs_to_user:
                # 1. Attribute stats to the author
                author_key = (author_name, author_email)
                contributors_data[author_key]["commits"] += 1
                contributors_data[author_key]["additions"] += commit_additions
                contributors_data[author_key]["deletions"] += commit_deletions
                contributors_data[author_key]["history"][week_start] += 1
                
                # 2. Attribute stats to all co-authors
                for co_name, co_email in commit_coauthors:
                    co_key = (co_name, co_email)
                    contributors_data[co_key]["commits"] += 1
                    contributors_data[co_key]["additions"] += commit_additions
                    contributors_data[co_key]["deletions"] += commit_deletions
                    contributors_data[co_key]["history"][week_start] += 1
                    
    except Exception as e:
        print(f"Error scanning repo at {repo_path}: {e}")
    
    return contributors_data

def find_git_repos(root_dir):
    """
    Recursively finds all Git repositories under root_dir.
    """
    repos = []
    if not os.path.exists(root_dir):
        return repos
        
    try:
        for root, dirs, files in os.walk(root_dir):
            if '.git' in dirs:
                repos.append(root)
                dirs.remove('.git')
    except Exception as e:
        print(f"Error scanning directory {root_dir}: {e}")
        
    return repos

def main():
    # Determine the directories to scan
    script_dir = os.path.dirname(os.path.abspath(__file__))
    readme_path = os.path.join(script_dir, 'README.md')
    db_path = os.path.join(script_dir, 'git_db.json')
    
    scan_dirs = [
        os.path.dirname(script_dir),  # c:\Program_user
        os.path.join(os.path.expanduser("~"), "OneDrive")  # OneDrive folder
    ]
    
    print("Scanning directories for Git repositories...")
    found_repos = []
    for d in scan_dirs:
        if os.path.exists(d):
            print(f"Scanning: {d}")
            repos = find_git_repos(d)
            print(f"-> Found {len(repos)} Git repos in {d}")
            found_repos.extend(repos)
            
    # Combine contributors data from all repos
    combined_data = defaultdict(lambda: {
        "commits": 0,
        "additions": 0,
        "deletions": 0,
        "history": defaultdict(int)
    })
    
    print(f"\nProcessing {len(found_repos)} repositories...")
    for repo_path in found_repos:
        repo_name = os.path.basename(repo_path)
        repo_data = parse_git_history(repo_path)
        
        # Merge repo_data into combined_data
        for contributor, stats in repo_data.items():
            combined_data[contributor]["commits"] += stats["commits"]
            combined_data[contributor]["additions"] += stats["additions"]
            combined_data[contributor]["deletions"] += stats["deletions"]
            for week, count in stats["history"].items():
                combined_data[contributor]["history"][week] += count
                
    # Separate you (User) from other collaborators/AIs
    user_stats = {
        "name": "2902Duy",
        "email": "tduy29.2k4@gmail.com",
        "commits": 0,
        "additions": 0,
        "deletions": 0,
        "avatar_url": "https://github.com/2902Duy.png",
        "is_registered": True,
        "history": defaultdict(int)
    }
    
    external_contributors = defaultdict(lambda: {
        "commits": 0,
        "additions": 0,
        "deletions": 0,
        "history": defaultdict(int)
    })
    
    for (name, email), stats in combined_data.items():
        lower_name = name.lower()
        lower_email = email.lower()
        
        # Check if this contributor is you
        is_self = any(sig in lower_name or sig in lower_email for sig in USER_SIGNATURES)
        
        if is_self:
            # Add to your overall user stats
            user_stats["commits"] += stats["commits"]
            user_stats["additions"] += stats["additions"]
            user_stats["deletions"] += stats["deletions"]
            for week, count in stats["history"].items():
                user_stats["history"][week] += count
        else:
            # It's an external collaborator or bot
            key = (name, email)
            external_contributors[key]["commits"] += stats["commits"]
            external_contributors[key]["additions"] += stats["additions"]
            external_contributors[key]["deletions"] += stats["deletions"]
            for week, count in stats["history"].items():
                external_contributors[key]["history"][week] += count

    # Determine if external co-authors are registered on GitHub
    processed_contributors = []
    
    # 1. Format your user stats
    user_history_sorted = [{"week": w, "commits": c} for w, c in sorted(user_stats["history"].items())]
    user_formatted = {
        "name": user_stats["name"],
        "email": user_stats["email"],
        "commits": user_stats["commits"],
        "additions": user_stats["additions"],
        "deletions": user_stats["deletions"],
        "avatar_url": user_stats["avatar_url"],
        "is_registered": True,
        "history": user_history_sorted
    }
    processed_contributors.append(user_formatted)
    
    # 2. Format external co-authors
    for (name, email), stats in external_contributors.items():
        lower_name = name.lower()
        lower_email = email.lower()
        
        # Check if email belongs to unregistered AI list
        is_unregistered_ai = any(kw in lower_name or kw in lower_email for kw in UNREGISTERED_AI_KEYWORDS)
        
        # Determine is_registered status
        is_registered = not is_unregistered_ai
        
        # Select avatar representation name
        avatar_rep = name.lower()
        if "claude" in avatar_rep:
            avatar_url = "logo-claude"
        elif "gemini" in avatar_rep or "antigravity" in avatar_rep:
            avatar_url = "logo-gemini"
        elif "gpt" in avatar_rep or "openai" in avatar_rep or "chat" in avatar_rep or "codex" in avatar_rep:
            avatar_url = "logo-chatgpt"
        elif "devin" in avatar_rep:
            avatar_url = "https://avatars.githubusercontent.com/u/158243242?v=4" # Devin Bot avatar
        else:
            avatar_url = "generic-dev"
            
        history_sorted = [{"week": w, "commits": c} for w, c in sorted(stats["history"].items())]
        
        processed_contributors.append({
            "name": name,
            "email": email,
            "commits": stats["commits"],
            "additions": stats["additions"],
            "deletions": stats["deletions"],
            "avatar_url": avatar_url,
            "is_registered": is_registered,
            "history": history_sorted
        })
        
    # Sort contributors: your account always stays at #1, others are ranked by commits descending
    user_contributor = [c for c in processed_contributors if c["name"] == "2902Duy"]
    others = [c for c in processed_contributors if c["name"] != "2902Duy"]
    others_sorted = sorted(others, key=lambda x: x["commits"], reverse=True)
    
    final_contributors = user_contributor + others_sorted
    
    # Write to git_db.json
    db_data = {
        "contributors": final_contributors
    }
    
    try:
        with open(db_path, 'w', encoding='utf-8') as f:
            json.dump(db_data, f, indent=2, ensure_ascii=False)
        print(f"Successfully wrote JSON database to {db_path}!")
    except Exception as e:
        print(f"Error writing git_db.json: {e}")
        
    # Write to README.md (excluding unregistered ones for the GitHub profile page to stay clean)
    registered_only_stats = [c for c in others_sorted if c["is_registered"]]
    
    if not registered_only_stats:
        markdown_table = "*No registered external co-authors or bots detected in your commits yet.*"
    else:
        markdown_table = "| Co-Author / AI Assistant | Commits | Email Alias |\n"
        markdown_table += "| :--- | :---: | :--- |\n"
        for c in registered_only_stats:
            markdown_table += f"| **{c['name']}** | {c['commits']} | `{c['email']}` |\n"
            
    # Update README.md
    if not os.path.exists(readme_path):
        print(f"Error: README.md not found at {readme_path}")
        return
        
    with open(readme_path, 'r', encoding='utf-8') as f:
        readme_content = f.read()
        
    start_tag = '<!-- COAUTHORS:START -->'
    end_tag = '<!-- COAUTHORS:END -->'
    
    start_idx = readme_content.find(start_tag)
    end_idx = readme_content.find(end_tag)
    
    if start_idx == -1 or end_idx == -1 or start_idx >= end_idx:
        print("Error: Could not find valid co-author placeholder comments in README.md")
        return
        
    # Replace content between comments
    new_content = (
        readme_content[:start_idx + len(start_tag)] + 
        "\n\n" + markdown_table + "\n\n" + 
        readme_content[end_idx:]
    )
    
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print(f"Successfully updated {readme_path}!")

if __name__ == '__main__':
    main()
