'use client'

import { useLayoutEffect, useRef } from 'react'

export default function AutoSizeTableCell(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { 'data-cell': string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const input = ref.current
    if (!input) return
    function fit() {
      if (!input) return
      input.style.height = '0px'
      input.style.height = `${input.scrollHeight}px`
    }
    fit()
    let width = input.getBoundingClientRect().width
    const observer = new ResizeObserver(() => {
      const nextWidth = input.getBoundingClientRect().width
      if (nextWidth !== width) { width = nextWidth; fit() }
    })
    observer.observe(input)
    return () => observer.disconnect()
  }, [props.value, props.style?.fontSize, props.style?.lineHeight, props.style?.padding])
  return <textarea {...props} ref={ref} rows={1} />
}
