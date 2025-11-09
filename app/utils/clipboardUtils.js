import { formatCitation } from './formatConverter';

export const copyFormattedCitation = (details, format) => {
  if (!details) {
    alert('No citation details to copy');
    return false;
  }

  try {
    const formatted = formatCitation(details, format);
    navigator.clipboard.writeText(formatted);
    alert(`✅ ${format} citation copied to clipboard!`);
    return true;
  } catch (error) {
    alert('❌ Error copying to clipboard: ' + error.message);
    return false;
  }
};
