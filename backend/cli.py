import argparse
import requests
import sys

def main():
    parser = argparse.ArgumentParser(description="Sentinel AI CLI Tool")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    run_parser = subparsers.add_parser("run", help="Run the pipeline on a repository or code snippet")
    run_parser.add_argument("repo", help="Target repository URL or file path")
    run_parser.add_argument("--code", help="Code snippet string to analyze", default="")

    args = parser.parse_args()

    if args.command == "run":
        print(f"🚀 Triggering Sentinel AI pipeline for: {args.repo}")
        
        code_to_send = args.code
        if not code_to_send:
            code_to_send = "def add(a, b):\n    return a + b"

        try:
            res = requests.post("http://localhost:8000/api/v1/analyze", json={
                "repo_url": args.repo,
                "code_content": code_to_send,
                "file_path": "main.py"
            })
            res.raise_for_status()
            print("✅ Pipeline started successfully!")
            print(res.json())
        except requests.exceptions.ConnectionError:
            print("❌ Error: Could not connect to the Sentinel AI backend at http://localhost:8000")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error: {e}")
            sys.exit(1)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
