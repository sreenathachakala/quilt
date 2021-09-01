import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import StyledLink from 'utils/StyledLink'
import { getBreadCrumbs } from 'utils/s3paths'

const useStyles = M.makeStyles((t) => ({
  crumb: {
    '& + &::before': {
      content: '"/"',
      display: 'inline-block',
      margin: t.spacing(0, 0.5),
    },
  },
  link: {},
  current: {},
}))

interface BreadcrumbsProps {
  className: string
  onClick: (path: string) => void
  path: string
  rootPath: string
}

export default function Breadcrumbs({
  className,
  path,
  rootPath,
  onClick,
}: BreadcrumbsProps) {
  const classes = useStyles()

  const items = getBreadCrumbs(path)

  return (
    <div className={className}>
      {items.map(({ label, path: segPath }) =>
        segPath === path || segPath.indexOf(rootPath) < 0 ? (
          <span className={cx(classes.crumb, classes.current)} key={segPath}>
            {label}
          </span>
        ) : (
          <StyledLink
            className={cx(classes.crumb, {
              [classes.link]: segPath !== path,
              [classes.current]: segPath === path,
            })}
            component="span"
            onClick={() => onClick(segPath)}
            onKeyPress={() => onClick(segPath)}
            role="link"
            tabIndex={0}
            key={segPath}
          >
            {label}
          </StyledLink>
        ),
      )}
    </div>
  )
}
