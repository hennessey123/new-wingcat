# Pushing to GitHub — the no-matter-what guide

Every push is the same three questions. When something breaks, it is almost always one of them:

1. **Do I have commits?** — `git status`
2. **Does git know where to send them?** — `git remote -v`
3. **Am I allowed to send them?** — auth
4. **Will the remote accept them?** — history mismatch

Work down the list. Whatever the error message says, the fix is in one of those four buckets.

---

## The happy path

```bash
git add -A                      # stage everything
git commit -m "what I changed"  # snapshot it
git push                        # send it
```

If that works, stop reading.

---

## First push of a brand-new project

```bash
cd /path/to/project
git init                                  # only if there's no .git yet
git add -A
git commit -m "Initial commit"

gh repo create NAME --public --source=. --push
```

`gh repo create` makes the repo on GitHub, wires up `origin`, and pushes — all at once. Use
`--private` instead of `--public` if you don't want it visible.

**If the repo already exists on GitHub:**

```bash
git remote add origin https://github.com/USER/REPO.git
git push -u origin main
```

The `-u` sets the upstream, so every later push is just `git push`.

---

## Auth: use HTTPS + gh, not SSH

SSH keys are the single most common source of push pain. Skip them entirely:

```bash
gh auth login        # once per machine — pick HTTPS
gh auth setup-git    # makes git use the gh token for github.com
```

Now every `git push` over an `https://` remote authenticates automatically. No keys, no
passwords, no expiring personal access tokens to paste.

To check where you stand:

```bash
gh auth status
```

---

## Problems, in the order you'll hit them

### `Permission denied (publickey)`

Your remote is SSH but this machine has no key registered. Switch the remote to HTTPS:

```bash
git remote set-url origin https://github.com/USER/REPO.git
gh auth setup-git
git push
```

### `remote: Repository not found` / `403`

Either the repo genuinely doesn't exist, or you're authenticated as the wrong account.

```bash
gh auth status                    # which account am I?
gh repo view USER/REPO            # does it exist and can I see it?
```

If it's the wrong account: `gh auth switch`.

### `fatal: 'origin' does not appear to be a git repository`

No remote configured.

```bash
git remote -v                                                  # confirm it's empty
git remote add origin https://github.com/USER/REPO.git
git push -u origin main
```

### `Updates were rejected because the remote contains work that you do not have`

Someone (or GitHub's "add a README" checkbox) committed to the remote after you last pulled.
Bring their work in, then push:

```bash
git pull --rebase
git push
```

`--rebase` replays your commits on top of theirs, so you don't get a noisy merge commit.

### `refusing to merge unrelated histories`

Your local repo and the remote were started independently — they share no common commit. This
happens when you `git init` locally *and* let GitHub create the repo with a README. Pick one:

```bash
# A) Your local version wins outright. Wipes remote history on this branch.
git push --force origin main

# B) Keep both. Stitch the histories together, resolve conflicts by hand.
git pull --allow-unrelated-histories
git push
```

Option A is right when the remote only has a stub README. Option B is right when the remote
has real work on it.

### `src refspec main does not match any`

Your branch isn't called `main`. Find out what it is:

```bash
git branch --show-current
```

Then push that name, or rename it:

```bash
git branch -M main
git push -u origin main
```

### `nothing to commit, working tree clean` but GitHub looks stale

You committed but never pushed, or you pushed a different branch.

```bash
git log --oneline -5              # what's committed locally
git log --oneline -5 origin/main  # what's on GitHub
git status                        # says "ahead of origin/main by N commits"
```

### `file is 123.00 MB; this exceeds GitHub's file size limit of 100.00 MB`

The file is baked into a commit, so deleting it now isn't enough — you have to remove it from
history. Easiest when the bad commit is your most recent:

```bash
git rm --cached path/to/huge-file
echo "path/to/huge-file" >> .gitignore
git commit --amend --no-edit
git push
```

If it's buried deeper, use `git filter-repo` or start a fresh branch from before it landed.

### Push hangs, or asks for a username and password

GitHub killed password auth in 2021. If you're being prompted, git isn't using your token:

```bash
gh auth setup-git
```

---

## The nuclear option

When the local repo is in a state you can't reason about and you just want what's on disk to be
what's on GitHub:

```bash
rm -rf .git
git init
git add -A
git commit -m "Reset history"
git remote add origin https://github.com/USER/REPO.git
git push --force -u origin main
```

**This destroys all history**, local and remote, on that branch. Only do it when the history has
no value to you.

---

## Useful checks

```bash
git remote -v                     # where does origin point
git status                        # staged / unstaged / ahead-behind
git log --oneline -10             # recent local commits
git ls-remote origin              # what branches actually exist on GitHub
gh auth status                    # who am I authenticated as
gh repo view --web                # open the repo in a browser
```

---

## This repo specifically

`origin` is `https://github.com/hennessey123/new-wingcat.git` over HTTPS with `gh` auth, so a
plain `git push` is all you need.

Because WINGCAT is one self-contained `index.html`, the whole publish loop is:

```bash
git add -A && git commit -m "tweak" && git push
```

GitHub Pages (once enabled in **Settings → Pages → Deploy from branch → main / root**) redeploys
within a minute. The `.nojekyll` file is what stops Pages from trying to run the site through
Jekyll.

> Note: `README.md` still links to `https://USERNAME.github.io/wingcat/`. The real URL will be
> `https://hennessey123.github.io/new-wingcat/`.
