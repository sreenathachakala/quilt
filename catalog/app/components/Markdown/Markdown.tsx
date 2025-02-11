import cx from 'classnames'
import createDOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/default.css'
import memoize from 'lodash/memoize'
import * as R from 'ramda'
import * as React from 'react'
import * as Remarkable from 'remarkable'
import { linkify } from 'remarkable/linkify'
import * as M from '@material-ui/core'

import { linkStyle } from 'utils/StyledLink'

/* Most of what's in the commonmark spec for HTML blocks;
 * minus troublesome/abusey/not-in-HTML5 tags: basefont, body, center, dialog,
 * dir, fieldset, form, frame, frameset, head, html, iframe, link, main, menu,
 * menuitem, meta, noframes,  optgroup, option, source (we don't support audio),
 * track (we don't support video).
 *
 * I opted not to include UI tags (opt, optgroup); ditto for base, body, head,
 * meta, title
 * which shouldn't be needed
 */
const SANITIZE_OPTS = {
  ALLOWED_TAGS: [
    'a',
    'abbr',
    'address',
    'article',
    'aside',
    'b',
    'blockquote',
    'caption',
    'code',
    'col',
    'colgroup',
    'dd',
    'details',
    'del',
    'div',
    'dl',
    'dt',
    'em',
    'figure',
    'figcaption',
    'footer',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hr',
    'i',
    'img',
    'ins',
    'legend',
    'li',
    'mark',
    'nav',
    'ol',
    'p',
    'param',
    'pre',
    'section',
    'span',
    'strong',
    'sub',
    'summary',
    'sup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'ul',
  ],
  FORBID_TAGS: ['style', 'script'],
  FORBID_ATTR: ['style'],
}

// TODO: switch to pluggable react-aware renderer
// TODO: use react-router's Link component for local links
const highlight = (str: string, lang: string) => {
  if (lang === 'none') {
    return ''
  }
  if (hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(str, { language: lang }).value
    } catch (err) {
      // istanbul ignore next
      console.error(err) // eslint-disable-line no-console
    }
  } else {
    try {
      return hljs.highlightAuto(str).value
    } catch (err) {
      // istanbul ignore next
      console.error(err) // eslint-disable-line no-console
    }
  }
  // istanbul ignore next
  return '' // use external default escaping
}

interface RemarkableWithUtils extends Remarkable.Remarkable {
  // NOTE: Remarkable.Remarkable doesn't export utils
  utils: {
    escapeHtml: (str: string) => string
    replaceEntities: (str: string) => string
    unescapeMd: (str: string) => string
  }
}

const escape = R.pipe(
  (Remarkable as unknown as RemarkableWithUtils).utils.replaceEntities,
  (Remarkable as unknown as RemarkableWithUtils).utils.escapeHtml,
)

/**
 * A Markdown (Remarkable) plugin. Takes a Remarkable instance and adjusts it.
 *
 * @typedef {function} MarkdownPlugin
 *
 * @param {Object} md Remarkable instance.
 */

/**
 * Create a plugin for remarkable that does custom processing of image tags.
 *
 * @param {Object} options
 * @param {bool} options.disable
 *   Don't show images, render them as they are in markdown contents (escaped).
 * @param {function} options.process
 *   Function that takes an image object ({ alt, src, title }) and returns a
 *   (possibly modified) image object.
 *
 * @returns {MarkdownPlugin}
 */
const imageHandler =
  ({ disable = false, process = R.identity }) =>
  (md: Remarkable.Remarkable) => {
    // eslint-disable-next-line no-param-reassign
    md.renderer.rules.image = (tokens, idx) => {
      const t = process(tokens[idx])

      if (disable) {
        const alt = t.alt ? escape(t.alt) : ''
        const src = escape(t.src)
        const title = t.title ? ` "${escape(t.title)}"` : ''
        return `<span>![${alt}](${src}${title})</span>`
      }

      const src = (Remarkable as unknown as RemarkableWithUtils).utils.escapeHtml(t.src)
      const alt = t.alt
        ? escape((Remarkable as unknown as RemarkableWithUtils).utils.unescapeMd(t.alt))
        : ''
      const title = t.title ? ` title="${escape(t.title)}"` : ''
      return `<img src="${src}" alt="${alt}"${title} />`
    }
  }

/**
 * Create a plugin for remarkable that does custom processing of links.
 *
 * @param {Object} options
 * @param {bool} options.nofollow
 *   Add rel="nofollow" attribute if true (default).
 * @param {function} options.process
 *   Function that takes a link object ({ href, title }) and returns a
 *   (possibly modified) link object.
 *
 * @returns {MarkdownPlugin}
 */
const linkHandler =
  ({ nofollow = true, process = R.identity }) =>
  (md: Remarkable.Remarkable) => {
    // eslint-disable-next-line no-param-reassign
    md.renderer.rules.link_open = (tokens, idx) => {
      const t = process(tokens[idx])
      const title = t.title ? ` title="${escape(t.title)}"` : ''
      const rel = nofollow ? ' rel="nofollow"' : ''
      return `<a href="${(Remarkable as unknown as RemarkableWithUtils).utils.escapeHtml(
        t.href,
      )}"${rel}${title}>`
    }
  }

/**
 * Get Remarkable instance based on the given options (memoized).
 *
 * @param {Object} options
 *
 * @param {boolean} images
 *   Whether to render images notated as `![alt](src title)` or skip them.
 *
 * @returns {Object} Remarakable instance
 */
export const getRenderer = memoize(({ images, processImg, processLink }) => {
  const md = new Remarkable.Remarkable('full', {
    highlight,
    html: true,
    typographer: true,
  }).use(linkify)
  md.use(linkHandler({ process: processLink }))
  md.use(imageHandler({ disable: !images, process: processImg }))
  const purify = createDOMPurify(window)
  return (data: string) => purify.sanitize(md.render(data), SANITIZE_OPTS)
})

interface ContainerProps {
  children: string
  className?: string
}

const useContainerStyles = M.makeStyles({
  root: {
    overflow: 'auto',

    '& a': linkStyle,

    '& h1 code': {
      backgroundColor: 'inherit',
    },

    /* prevent horizontal overflow */
    '& img': {
      maxWidth: '100%',
    },

    '& table': {
      maxWidth: '100%',
      width: '100%',

      'th, td': {
        lineHeight: '1.5em',
        padding: '8px',
        textAlign: 'left',
      },

      '&, th, td': {
        border: '1px solid #ddd',
      },
    },
  },
})

export function Container({ className, children }: ContainerProps) {
  const classes = useContainerStyles()
  return (
    <div
      className={cx(className, classes.root)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: children }}
    />
  )
}

interface MarkdownProps extends Omit<ContainerProps, 'children'> {
  data?: string
  images?: boolean
  processImg?: () => $TSFixMe
  processLink?: () => $TSFixMe
}

export default function Markdown({
  data,
  images = true,
  processImg,
  processLink,
  ...props
}: MarkdownProps) {
  return (
    <Container {...props}>
      {getRenderer({ images, processImg, processLink })(data || '')}
    </Container>
  )
}
