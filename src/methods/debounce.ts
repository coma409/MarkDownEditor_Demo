//debounce.ts
export function debounce<T extends any[]>(func: (...args: T) => void, wait: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: T) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
  };
}