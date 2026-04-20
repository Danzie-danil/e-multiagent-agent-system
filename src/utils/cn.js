// utils/cn.js — classname helper
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}
