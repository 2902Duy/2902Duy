import os
import re
import subprocess
from collections import Counter

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

def main():
    # Determine the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    readme_path = os.path.join(script_dir, 'README.md')
    
    # We want to scan the parent directory c:\Program_user
    parent_dir = os.path.dirname(script_dir)
    print(f"Scanning parent directory: {parent_dir}")
    
    all_coauthors = []
    
    # Scan subdirectories for git repositories
    for item in os.listdir(parent_dir):
        item_path = os.path.join(parent_dir, item)
        if os.path.isdir(item_path):
            git_path = os.path.join(item_path, '.git')
            if os.path.exists(git_path) and os.path.isdir(git_path):
                print(f"Found git repository: {item}")
                repo_coauthors = get_git_coauthors(item_path)
                print(f"-> Extracted {len(repo_coauthors)} co-author lines")
                all_coauthors.extend(repo_coauthors)
                
    # Filter out the user's own commits/usernames
    exclude_keywords = ['2902duy', 'duy2902', 'tduy29.2k4@gmail.com']
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
