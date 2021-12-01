import { PureComponent } from 'react'
import React from 'react'
import classNames from 'classnames'
import { Spin } from 'antd'
import { AutoSizer, Grid, CellMeasurer, CellMeasurerCache } from 'react-virtualized'
import AntTableAdaptor from './AntTableAdaptor'
import { getColumnKey } from './AntTableAdaptor/util'
import shallowEqual from 'shallowequal'
import cx from 'classnames'

class VGrid extends PureComponent {
  constructor(props) {
    super(props)
    props.getOnChange(() => this.recomputeGridSize())
  }

  state = {
    overscanRowCount: 6,
    scrollLeft: 0,
    scrollTop: 0,
    scrollbarSize: 0,
    showHorizontalScrollbar: false,
    showVerticalScrollbar: false,
  }

  _keyMapper = (rowIndex, columnIndex) => {
    const { dataSource, columns, getRowKey } = this.props
    const col = columns[columnIndex]
    if (!col) return null
    if (dataSource[rowIndex] && getRowKey) {
      return getRowKey(dataSource[rowIndex], rowIndex) + '-' + getColumnKey(col, columnIndex)
    }
    return `${rowIndex}-${columnIndex}`
  }
  _cache = new CellMeasurerCache({
    fixedWidth: true,
    defaultHeight: this.props.headerHeight,
    keyMapper: this._keyMapper,
  })
  _bottomLeftGrid = null
  _bottomRightGrid = null
  _topLeftGrid = null
  _topRightGrid = null
  _bottomLeftGridRef = (ref) => (this._bottomLeftGrid = ref)
  _bottomRightGridRef = (ref) => (this._bottomRightGrid = ref)
  _topLeftGridRef = (ref) => (this._topLeftGrid = ref)
  _topRightGridRef = (ref) => (this._topRightGrid = ref)

  _deferredInvalidateColumnIndex = null
  _deferredInvalidateRowIndex = null

  componentDidMount() {
    this._handleInvalidatedGridSize()
  }

  componentDidUpdate(prevProps) {
    const { resetDeps, dataSource, columns, loading } = this.props
    let shouldRecompute = false
    let shouldClearCache = false
    if (!shallowEqual(prevProps.resetDeps, resetDeps)) {
      shouldClearCache = true
      shouldRecompute = true
    }
    if (dataSource !== prevProps.dataSource || !shallowEqual(loading, prevProps.loading)) {
      shouldRecompute = true
    }
    if (columns.length !== prevProps.columns.length) {
      this._cache._columnCount = columns.length
      shouldClearCache = true
      shouldRecompute = true
    }
    shouldRecompute && this.recomputeGridSize()
    if (shouldClearCache) {
      this._cache.clearAll()
      this._deferredInvalidateColumnIndex = 0
      this._deferredInvalidateRowIndex = 0
    }
    this._handleInvalidatedGridSize()
  }

  recomputeGridSize({ columnIndex = 0, rowIndex = 0 } = {}) {
    const { fixedColumnCount, fixedRowCount } = this.props
    const adjustedColumnIndex = Math.max(0, columnIndex - fixedColumnCount)
    const adjustedRowIndex = Math.max(0, rowIndex - fixedRowCount)
    this._bottomLeftGrid?.recomputeGridSize({ columnIndex, rowIndex: adjustedRowIndex })
    this._bottomRightGrid?.recomputeGridSize({
      columnIndex: adjustedColumnIndex,
      rowIndex: adjustedRowIndex,
    })
    this._topLeftGrid?.recomputeGridSize({ columnIndex, rowIndex })
    this._topRightGrid?.recomputeGridSize({ columnIndex: adjustedColumnIndex, rowIndex })
  }

  // for CellMeasurer to sync fixed column height
  invalidateCellSizeAfterRender({ columnIndex = 0, rowIndex = 0 } = {}) {
    this._deferredInvalidateColumnIndex =
      typeof this._deferredInvalidateColumnIndex === 'number'
        ? Math.min(this._deferredInvalidateColumnIndex, columnIndex)
        : columnIndex
    this._deferredInvalidateRowIndex =
      typeof this._deferredInvalidateRowIndex === 'number'
        ? Math.min(this._deferredInvalidateRowIndex, rowIndex)
        : rowIndex
  }

  _handleInvalidatedGridSize() {
    if (typeof this._deferredInvalidateColumnIndex === 'number') {
      const columnIndex = this._deferredInvalidateColumnIndex
      const rowIndex = this._deferredInvalidateRowIndex

      this._deferredInvalidateColumnIndex = null
      this._deferredInvalidateRowIndex = null

      this.recomputeGridSize({ columnIndex, rowIndex })
      this.forceUpdate()
    }
  }

  forceUpdateGrids() {
    this._topRightGrid?.forceUpdate()
    this._bottomRightGrid?.forceUpdate()
    this._topLeftGrid?.forceUpdate()
    this._bottomLeftGrid?.forceUpdate()
  }

  _onScrollbarPresenceChange = ({ horizontal, size, vertical }) => {
    const { showHorizontalScrollbar, showVerticalScrollbar } = this.state

    if (horizontal !== showHorizontalScrollbar || vertical !== showVerticalScrollbar) {
      this.setState({
        scrollbarSize: size,
        showHorizontalScrollbar: horizontal,
        showVerticalScrollbar: vertical,
      })

      const { onScrollbarPresenceChange } = this.props
      if (typeof onScrollbarPresenceChange === 'function') {
        onScrollbarPresenceChange({
          horizontal,
          size,
          vertical,
        })
      }
    }
  }

  _onScroll = (scrollInfo, cb) => {
    const { scrollLeft, scrollTop } = scrollInfo
    this.setState({ scrollLeft, scrollTop }, cb)
  }
  _onScrollLeft = (scrollInfo) => {
    const { scrollLeft } = scrollInfo
    this._onScroll({
      scrollLeft,
      scrollTop: this.state.scrollTop,
    })
  }
  _onScrollTop = (scrollInfo) => {
    const { scrollTop } = scrollInfo
    this._onScroll({
      scrollTop,
      scrollLeft: this.state.scrollLeft,
    })
  }
  hoveredRowIndex = null
  frame = 0
  onSetHover = (rowIndex) => {
    cancelAnimationFrame(this.frame)
    this.frame = requestAnimationFrame(() => {
      this.hoveredRowIndex = rowIndex
      this.forceUpdateGrids()
    })
  }

  _renderLeftHeaderCell = ({ columnIndex, style, rowIndex }) => {
    const col = this.props.columns[columnIndex]
    const headerAttrs = col.onHeaderCell?.(col) ?? {}
    const cellClasses = classNames({
      [col.className]: true,
      ReactVirtualized__Table__headerColumn: true,
      [headerAttrs.className]: true,
    })
    return (
      <div
        key={this._keyMapper(rowIndex, columnIndex)}
        style={style}
        {...headerAttrs}
        className={cellClasses}
      >
        {col.title}
      </div>
    )
  }
  _renderHeaderCell = ({ columnIndex, style, rowIndex }) => {
    const { fixedColumnCount } = this.props
    if (columnIndex < fixedColumnCount) return null
    return this._renderLeftHeaderCell({ columnIndex, style, rowIndex })
  }
  _cellRendererBottomRightGrid = ({ columnIndex, rowIndex, ...rest }) => {
    const { fixedColumnCount } = this.props
    if (columnIndex < fixedColumnCount)
      return <div key={this._keyMapper(rowIndex, columnIndex) + '_DUM'} style={rest.style} /> //keep display scrollbar
    return this._renderCell({ columnIndex, rowIndex, ...rest })
  }
  _renderCell = ({ columnIndex, rowIndex, isScrolling, parent, style }) => {
    const { dataSource, onRow, rowClassName, columns } = this.props
    const col = columns[columnIndex]
    const colWidth = parent.props.columnWidth({ index: columnIndex })
    const rowData = dataSource[rowIndex]
    const cellData = rowData && rowData[col.dataIndex]
    const cellClasses = classNames({
      [col.className]: true,
      'virtualized-table-cell': true,
      'grid-cell': true,
      'grid-cell-hovered': this.hoveredRowIndex === rowIndex,
    })
    const rowAttrs = onRow(rowData)
    return (
      <CellMeasurer
        cache={this._cache}
        key={this._keyMapper(rowIndex, columnIndex)}
        parent={this}
        rowIndex={rowIndex}
        columnIndex={columnIndex}
      >
        <div style={{ ...style, width: colWidth }} className={rowClassName(rowData)} {...rowAttrs}>
          <div
            className={cellClasses}
            onMouseEnter={() => !isScrolling && this.onSetHover(rowIndex)}
            onMouseLeave={() => !isScrolling && this.onSetHover(null)}
          >
            {col.render ? col.render(cellData, rowData, rowIndex) : String(cellData)}
          </div>
        </div>
      </CellMeasurer>
    )
  }
  onResize = ({ width }) => {
    if (width !== this._lastRenderedWidth) {
      cancelAnimationFrame(this.framer)
      this.framer = requestAnimationFrame(() => {
        this._lastRenderedWidth = width
        this.recomputeGridSize()
      })
    }
  }

  render() {
    const {
      dataSource,
      loading,
      className,
      style,
      fixedColumnCount,
      headerHeight,
      scroll,
      emptyText,
      footer,
      columns,
      disableTitleScrollbar,
      scrollToRow,
      size,
    } = this.props
    const {
      overscanRowCount,
      scrollLeft,
      scrollTop,
      scrollbarSize,
      showVerticalScrollbar,
      showHorizontalScrollbar,
    } = this.state
    return (
      <div className={cx(className, 'virtualized-wrapper')} style={{ height: scroll?.y, ...style }}>
        <Spin {...loading}>
          <div style={{ flex: 1 }}>
            <AutoSizer onResize={this.onResize}>
              {({ height, width }) => {
                if (!width) return null
                const noWidthCount = columns.filter(({ width }) => !width).length
                const colWidths = columns.map((col) => {
                  if (col.className === 'ant-table-selection-column') {
                    if (size === 'small') return Math.max(col.width, 46)
                    return col.width
                  }
                  if (/^\d+(\.\d+)?(px)?$/.test(col.width)) return parseFloat(col.width)
                  return width / noWidthCount
                })
                let fixedColumnWidth = 0
                for (let i = 0; i < fixedColumnCount; i++) {
                  fixedColumnWidth += colWidths[i]
                }
                const horizonScrollbarHeight = showHorizontalScrollbar ? scrollbarSize : 0
                const verticalScrollbarHeight = showVerticalScrollbar ? scrollbarSize : 0
                const scrollTableHeight = dataSource.length ? Math.max(height - headerHeight, 0) : 0
                const fixedTableHeight = Math.max(scrollTableHeight - horizonScrollbarHeight, 0)
                return (
                  <div style={{ position: 'relative' }}>
                    {fixedColumnCount > 0 ? (
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          height: height - horizonScrollbarHeight,
                          width: fixedColumnWidth,
                          zIndex: 1,
                        }}
                        className={scrollLeft > 10 ? 'v-table-fixed-left' : ''}
                      >
                        <div
                          className={'header-grid'}
                          style={{ height: headerHeight, overflow: 'hidden' }}
                        >
                          <Grid
                            ref={this._topLeftGridRef}
                            cellRenderer={this._renderLeftHeaderCell}
                            columnWidth={({ index }) => colWidths[index]}
                            height={headerHeight}
                            rowHeight={headerHeight}
                            width={fixedColumnWidth}
                            rowCount={1}
                            columnCount={fixedColumnCount}
                          />
                        </div>
                        <div
                          style={{
                            width: fixedColumnWidth,
                            height: fixedTableHeight,
                            overflow: 'hidden',
                          }}
                        >
                          <Grid
                            ref={this._bottomLeftGridRef}
                            overscanRowCount={overscanRowCount}
                            cellRenderer={this._renderCell}
                            columnWidth={({ index }) => colWidths[index]}
                            scrollTop={scrollTop}
                            onScroll={this._onScrollTop}
                            columnCount={fixedColumnCount}
                            height={fixedTableHeight}
                            rowHeight={this._cache.rowHeight}
                            rowCount={dataSource.length}
                            width={fixedColumnWidth + verticalScrollbarHeight}
                          />
                        </div>
                      </div>
                    ) : null}
                    <div
                      className={'header-grid'}
                      style={{
                        height: headerHeight,
                        width: width,
                        overflow: 'hidden',
                      }}
                    >
                      <Grid
                        ref={this._topRightGridRef}
                        columnWidth={({ index }) => colWidths[index]}
                        columnCount={columns.length}
                        height={headerHeight + horizonScrollbarHeight}
                        cellRenderer={this._renderHeaderCell}
                        rowHeight={headerHeight}
                        rowCount={1}
                        onScroll={this._onScrollLeft}
                        style={{
                          overflowX:
                            !disableTitleScrollbar && dataSource.length ? 'auto' : 'hidden',
                        }}
                        scrollLeft={scrollLeft}
                        width={width - verticalScrollbarHeight}
                      />
                    </div>
                    <div
                      style={{
                        height: scrollTableHeight,
                        width,
                      }}
                    >
                      <Grid
                        ref={this._bottomRightGridRef}
                        columnWidth={({ index }) => colWidths[index]}
                        columnCount={columns.length}
                        height={scrollTableHeight}
                        onScroll={this._onScroll}
                        scrollTop={scrollTop}
                        scrollLeft={scrollLeft}
                        scrollToRow={scrollToRow}
                        onScrollbarPresenceChange={this._onScrollbarPresenceChange}
                        overscanRowCount={overscanRowCount}
                        cellRenderer={this._cellRendererBottomRightGrid}
                        deferredMeasurementCache={this._cache}
                        rowHeight={this._cache.rowHeight}
                        rowCount={dataSource.length}
                        width={width}
                      />
                    </div>
                  </div>
                )
              }}
            </AutoSizer>
            {!dataSource.length && (
              <div className={'ant-table-placeholder'} style={{ paddingTop: headerHeight }}>
                {!loading?.spinning && emptyText}
              </div>
            )}
          </div>
          {footer ? (
            <div className={'ant-table-footer'} style={{ flexShrink: 0 }}>
              {footer()}
            </div>
          ) : null}
        </Spin>
      </div>
    )
  }
}

export default AntTableAdaptor(VGrid)
