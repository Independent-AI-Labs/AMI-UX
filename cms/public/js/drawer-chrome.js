import { spinnerIcon } from './icon-pack.js?v=20250306'

export function createDrawerChrome(React) {
  const e = React.createElement

  const isString = (value) => typeof value === 'string'

  const renderIconMarkup = (icon) => {
    if (!icon) return null
    if (isString(icon)) {
      return e('span', {
        className: 'drawer-icon-button__icon',
        dangerouslySetInnerHTML: { __html: icon },
        'aria-hidden': 'true',
      })
    }
    return icon
  }

  const SPINNER_ICON = spinnerIcon()

  function DrawerIconButton({
    icon,
    label,
    onClick,
    disabled = false,
    type = 'button',
    active = false,
    variant = 'plain',
    className,
  }) {
    const classes = ['icon-button', 'drawer-icon-button']
    if (variant === 'accent') classes.push('icon-button--accent', 'drawer-icon-button--accent')
    if (variant === 'danger') classes.push('drawer-icon-button--danger')
    if (variant === 'ghost') classes.push('drawer-icon-button--ghost')
    if (active) classes.push('is-active')
    if (className) classes.push(className)
    return e(
      'button',
      {
        type,
        className: classes.join(' '),
        onClick: (event) => {
          event.preventDefault()
          if (!disabled) onClick?.(event)
        },
        disabled,
        title: label,
        'aria-label': label,
      },
      renderIconMarkup(icon),
    )
  }

  function DrawerListItem({
    icon,
    title,
    titleVisuallyHidden = false,
    active = false,
    status = null,
    badges = [],
    subtitles = [],
    actions = [],
    footer = null,
    selected = false,
    busy = false,
    onClick,
    onDoubleClick,
    onContextMenu,
    onMouseEnter,
    onMouseLeave,
    className,
    dataAttributes = {},
  }) {
    const lines = Array.isArray(subtitles) ? subtitles.filter((line) => line != null && line !== '') : []
    const firstLine = lines[0]
    const secondLine = lines[1]

    const badgeNodes = Array.isArray(badges)
      ? badges
          .filter(Boolean)
          .map((badge) => {
            const classes = ['drawer-list-item__badge']
            if (badge?.tone) classes.push(`drawer-list-item__badge--${badge.tone}`)
            return e(
              'span',
              {
                key: badge?.key || badge?.text,
                className: classes.join(' '),
              },
              badge?.text || badge,
            )
          })
      : []

    const actionNodes = Array.isArray(actions)
      ? actions
          .filter(Boolean)
          .map((action) =>
            e(DrawerIconButton, {
              key: action.key || action.label,
              icon: action.busy ? SPINNER_ICON : action.icon,
              label: action.label,
              onClick: action.onClick
                ? (event) => {
                    event.stopPropagation()
                    action.onClick?.(event)
                  }
                : undefined,
              disabled: !!action.disabled || !!action.busy,
              variant: action.variant || 'plain',
              active: !!action.active,
            }),
          )
      : []

    const classes = ['drawer-list-item']
    if (selected) classes.push('is-selected')
    if (active) classes.push('is-active')
    if (className) classes.push(className)

    const props = {
      className: classes.join(' '),
      onClick,
      onDoubleClick,
      onContextMenu,
      onMouseEnter,
      onMouseLeave,
    }

    Object.entries(dataAttributes || {}).forEach(([key, value]) => {
      if (key && key.startsWith('data-')) props[key] = value
    })

    const resolvedStatus = (() => {
      if (status && typeof status === 'object') return status
      if (active) return { tone: 'positive', label: 'Active' }
      return null
    })()

    const statusNode = (() => {
      if (!resolvedStatus) return null
      const tone = resolvedStatus.tone || 'positive'
      const indicatorClasses = ['status-indicator', 'serve-dot', 'drawer-list-item__status', `status-indicator--${tone}`]
      if (resolvedStatus.className) indicatorClasses.push(resolvedStatus.className)
      const props = {
        className: indicatorClasses.join(' '),
        'data-tone': tone,
      }
      const hint = (() => {
        const source = resolvedStatus.hint
        if (!source) return null
        if (typeof source === 'string') return { text: source, tone: 'neutral' }
        if (typeof source === 'object') {
          const text = source.text || source.content || source.label || null
          if (text) return { text, tone: source.tone || 'neutral' }
        }
        return null
      })()
      if (hint) {
        props['data-hint'] = hint.text
        props['data-hint-tone'] = hint.tone
        props.className += ' has-hint'
      }
      if (resolvedStatus.label) {
        props.title = resolvedStatus.label
        props.role = 'img'
        props['aria-label'] = resolvedStatus.label
      } else {
        props['aria-hidden'] = 'true'
      }
      if (resolvedStatus.dataAttributes && typeof resolvedStatus.dataAttributes === 'object') {
        Object.entries(resolvedStatus.dataAttributes).forEach(([key, value]) => {
          if (key && key.startsWith('data-')) props[key] = value
        })
      }
      if (resolvedStatus.icon) {
        return e(
          'span',
          props,
          renderIconMarkup(resolvedStatus.icon),
        )
      }
      return e('span', props)
    })()

    const titleMainChildren = []
    if (statusNode) titleMainChildren.push(statusNode)
    titleMainChildren.push(
      e(
        'span',
        {
          className: `drawer-list-item__title${titleVisuallyHidden ? ' sr-only' : ''}`,
          title: isString(title) ? title : undefined,
        },
        title,
      ),
    )

    return e(
      'div',
      props,
      icon
        ? e(
            'div',
            { className: 'drawer-list-item__icon', 'aria-hidden': 'true' },
            renderIconMarkup(icon),
          )
        : null,
      e(
        'div',
        { className: 'drawer-list-item__body' },
        e(
          'div',
          { className: 'drawer-list-item__title-row' },
          e('div', { className: 'drawer-list-item__title-main' }, ...titleMainChildren),
          ...badgeNodes,
        ),
        firstLine
          ? e(
              'div',
              { className: 'drawer-list-item__subtitle' },
              firstLine,
            )
          : null,
        secondLine
          ? e(
              'div',
              { className: 'drawer-list-item__subtitle drawer-list-item__subtitle--muted' },
              secondLine,
            )
          : null,
        footer ? e('div', { className: 'drawer-list-item__footer' }, footer) : null,
      ),
      busy && !actionNodes.length
        ? e('div', {
            className: 'drawer-list-item__actions',
            dangerouslySetInnerHTML: { __html: SPINNER_ICON },
          })
        : null,
      actionNodes.length
        ? e(
            'div',
            { className: 'drawer-list-item__actions' },
            ...actionNodes,
          )
        : null,
    )
  }

  function DrawerHeader({
    title,
    description,
    onClose,
    closeLabel = 'Close drawer',
    filter,
    actions = [],
    controls,
  }) {
    const controlNodes = []

    if (filter && typeof filter === 'object') {
      controlNodes.push(
        e('div', { className: 'drawer-shell-header__filter', key: 'filter' },
          e('input', {
            type: filter.type || 'search',
            className: 'drawer-shell-header__search-input',
            placeholder: filter.placeholder || '',
            value: filter.value ?? '',
            onChange: (event) => filter.onChange?.(event),
            'aria-label': filter.ariaLabel || filter.placeholder || 'Filter items',
          }),
        ),
      )
    }

    if (typeof controls === 'function') {
      const nodes = controls({ DrawerIconButton, renderIconMarkup })
      if (Array.isArray(nodes)) controlNodes.push(...nodes)
      else if (nodes) controlNodes.push(nodes)
    }

    if (Array.isArray(actions) && actions.length) {
      controlNodes.push(
        e(
          'div',
          { className: 'drawer-shell-header__actions', key: 'actions' },
          ...actions.map((action) =>
            e(DrawerIconButton, {
              key: action.key || action.label,
              icon: action.icon,
              label: action.label,
              onClick: action.onClick,
              disabled: !!action.disabled,
              active: !!action.active,
            }),
          ),
        ),
      )
    }

    return e(
      'div',
      { className: 'drawer-shell-header' },
      e(
        'div',
        { className: 'drawer-shell-header__row' },
        e(
          'div',
          { className: 'drawer-shell-header__titles' },
          e('strong', { className: 'drawer-shell-header__title' }, title || 'Untitled'),
        ),
        controlNodes.length
          ? e('div', { className: 'drawer-shell-header__controls' }, ...controlNodes)
          : null,
        e(
          'button',
          {
            type: 'button',
            className: 'icon-button dialog-close',
            onClick: (event) => {
              event.preventDefault()
              onClose?.(event)
            },
            'aria-label': closeLabel,
            title: closeLabel,
          },
          e('span', { 'aria-hidden': 'true' }, '×'),
        ),
      ),
      description
        ? e('p', { className: 'drawer-shell-header__subtitle' }, description)
        : null,
    )
  }

  return { DrawerHeader, DrawerIconButton, DrawerListItem }
}
