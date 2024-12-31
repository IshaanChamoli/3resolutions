export function formatNameForUrl(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '') // Remove all spaces
    .replace(/[^a-z0-9]/g, ''); // Remove any non-alphanumeric characters
} 