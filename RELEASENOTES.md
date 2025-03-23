# RELEASENOTES

## 0.4

### Features

- Added support of grouping using `()` regex. The resulting value will be
  used to find duplicatess. Example:
  ```python
  RegEx:
  r"\b(github\.com\/[\d\w-]+\/[\d\w-]+\/pull\/\d+)\/?\b"

  # One of those tabs will be marked as dublicate
  https://github.com/timoschenko/no-more-tabs/pull/3/commits
  https://github.com/timoschenko/no-more-tabs/pull/3/files
  ```

## 0.3

- TypeScript;

## 0.2

### Features

- Added support of Tab icons;
- Added "Merge Windows" button that moves all tabs into single window;
- Added "Settings" page;
- Added "Litter URLs". The app also will promt to close those tabs because
  of user mark them as "litter";

  Good to have here search engine results or sites that produce ton of minor
  priority tabs.
- Added Light/Dark UI Support;

### Bug fix

- Tab dups list now respect sorting;
- Tab dups list now remove closed tabs;

## 0.1

- Initial release
