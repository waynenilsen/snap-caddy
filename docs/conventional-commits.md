# Conventional Commits Guide

This project follows the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/) specification for commit messages. This creates an explicit commit history that enables automated tooling and makes the project history easier to navigate.

## Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types

| Type | Description | SemVer |
|------|-------------|--------|
| `feat` | A new feature | MINOR |
| `fix` | A bug fix | PATCH |
| `docs` | Documentation only changes | - |
| `style` | Changes that don't affect code meaning (whitespace, formatting) | - |
| `refactor` | Code change that neither fixes a bug nor adds a feature | - |
| `perf` | Performance improvement | - |
| `test` | Adding or correcting tests | - |
| `build` | Changes to build system or dependencies | - |
| `ci` | Changes to CI configuration | - |
| `chore` | Other changes that don't modify src or test files | - |

## Breaking Changes

Breaking changes correlate with a MAJOR version bump in SemVer. Indicate them by:

1. Adding `!` after the type/scope: `feat!: remove deprecated API`
2. Adding a `BREAKING CHANGE:` footer
3. Both methods can be combined

## Examples

### Simple commits

```
feat: add camera capture component
fix: prevent racing of segmentation requests
docs: correct spelling in README
refactor: simplify wizard state management
test: add unit tests for OpenSCAD generator
```

### With scope

```
feat(wizard): add step validation
fix(api): handle timeout errors in segment endpoint
docs(readme): update installation instructions
```

### Breaking change with `!`

```
feat!: change API response format for /api/generate
feat(api)!: require authentication for all endpoints
```

### With body and footer

```
fix: prevent racing of requests

Introduce a request id and a reference to latest request. Dismiss
incoming responses other than from latest request.

Remove timeouts which were used to mitigate the racing issue but are
obsolete now.

Reviewed-by: Jane Doe
Refs: #123
```

### Breaking change with footer

```
feat: allow provided config object to extend other configs

BREAKING CHANGE: `extends` key in config file is now used for
extending other config files
```

### Multiple footers

```
fix(segmentation): resolve mask boundary detection issue

The contour detection was failing on complex shapes with internal
holes. Updated algorithm to handle nested boundaries correctly.

Fixes: #456
Reviewed-by: John Smith
Co-authored-by: Jane Doe <jane@example.com>
```

## Scopes for This Project

Recommended scopes based on project structure:

| Scope | Description |
|-------|-------------|
| `wizard` | Wizard flow and navigation |
| `capture` | Image capture components |
| `segment` | SAM segmentation |
| `calibrate` | Ruler calibration |
| `config` | Gridfinity configuration |
| `generate` | STL generation |
| `api` | API routes and handlers |
| `ui` | UI components (shadcn/ui) |
| `openscad` | OpenSCAD integration |
| `sam` | SAM model integration |
| `deps` | Dependencies |

## Benefits

- **Automatic CHANGELOGs**: Generate release notes from commit history
- **Semantic versioning**: Determine version bumps automatically
- **Clear history**: Understand changes at a glance
- **Better collaboration**: Teammates understand commit intent
- **Tooling support**: Works with release automation tools

## Tips

1. **Keep commits focused**: Each commit should represent one logical change
2. **Write in imperative mood**: "add feature" not "added feature"
3. **Keep descriptions short**: Aim for 50 characters or less
4. **Use body for details**: Explain "what" and "why", not "how"
5. **Reference issues**: Use footers like `Fixes: #123` or `Refs: #456`

## Fixing Mistakes

**Wrong type (before merge)**:
```bash
git rebase -i HEAD~n  # Edit the commit
```

**Wrong type (after merge)**:
The commit will simply be missed by automation tools - not a critical error.

## Resources

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
- [Semantic Versioning](https://semver.org/)
