import os
import re
import subprocess
import sys
from collections import Counter

# Force stdout and stderr to use UTF-8 to prevent Windows terminal encoding crashes
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass  # Fallback for Python versions < 3.7

def get_git_coauthors(repo_path):
    """
    Runs git log in the specified repository path to extract all Co-authored-by lines.
    """
    coauthors = []
    try:
        # Run git log to output all commit messages
        result = subprocess.run(
            ['git', 'log', '--all', '--pretty=format:%B'],
            cwd=repo_path,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        if result.returncode != 0:
            return coauthors

        # Regular expression to extract Co-authored-by lines
        # Format: Co-authored-by: Name <email>
        pattern = re.compile(r'(?i)Co-authored-by:\s*([^<]+)\s*<([^>]+)>')
        
        for line in result.stdout.splitlines():
            match = pattern.search(line)
            if match:
                name = match.group(1).strip()
                email = match.group(2).strip()
                coauthors.append((name, email))
    except Exception as e:
        print(f"Error scanning repo at {repo_path}: {e}")
    
    return coauthors

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
                # Don't descend further into this git repo's subfolders
                dirs.remove('.git')
    except Exception as e:
        print(f"Error scanning directory {root_dir}: {e}")
        
    return repos

def main():
    # Determine the directories to scan
    script_dir = os.path.dirname(os.path.abspath(__file__))
    readme_path = os.path.join(script_dir, 'README.md')
    
    # We will scan c:\Program_user and C:\Users\<user>\OneDrive
    scan_dirs = [
        os.path.dirname(script_dir),  # c:\Program_user
        os.path.join(os.path.expanduser("~"), "OneDrive")  # OneDrive folder
    ]
    
    all_coauthors = []
    
    print("Scanning directories for Git repositories...")
    found_repos = []
    for d in scan_dirs:
        if os.path.exists(d):
            print(f"Scanning: {d}")
            repos = find_git_repos(d)
            print(f"-> Found {len(repos)} Git repos in {d}")
            found_repos.extend(repos)
            
    print(f"\nProcessing {len(found_repos)} repositories...")
    for repo_path in found_repos:
        repo_name = os.path.basename(repo_path)
        repo_coauthors = get_git_coauthors(repo_path)
        if repo_coauthors:
            print(f"- {repo_name}: Found {len(repo_coauthors)} co-authored commits")
            all_coauthors.extend(repo_coauthors)
                
    # Filter out the user's own commits/usernames
    exclude_keywords = ['2902duy', 'duy2902', 'tduy29.2k4@gmail.com', 'dyu2902', 'dqhfit', 'toanvu']
    filtered_coauthors = []
    for name, email in all_coauthors:
        lower_name = name.lower()
        lower_email = email.lower()
        should_exclude = any(kw in lower_name or kw in lower_email for kw in exclude_keywords)
        if not should_exclude:
            filtered_coauthors.append((name, email))
            
    # Aggregate and count
    counts = Counter(filtered_coauthors)
    
    # Sort by number of commits in descending order
    sorted_coauthors = sorted(counts.items(), key=lambda x: x[1], reverse=True)
    
    # Generate markdown table
    if not sorted_coauthors:
        markdown_table = "*No AI or external co-authors detected in project history yet.*"
    else:
        markdown_table = "| Co-Author / AI Assistant | Commits | Email Alias |\n"
        markdown_table += "| :--- | :---: | :--- |\n"
        for (name, email), count in sorted_coauthors:
            # Highlight AI assistant names nicely
            markdown_table += f"| **{name}** | {count} | `{email}` |\n"
            
    print(f"\nGenerated Co-Author stats:\n{markdown_table}\n")
    
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
