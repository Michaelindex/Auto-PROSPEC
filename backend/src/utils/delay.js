export function randomDelay(minSec, maxSec) {
  const ms = (Math.random() * (maxSec - minSec) + minSec) * 1000
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
