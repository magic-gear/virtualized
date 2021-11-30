import React, { forwardRef, useMemo, useRef } from 'react'
import { Table } from 'antd'
import classNames from 'classnames'
import defaultLocale from 'antd/lib/locale-provider/default'
import useLazyKVMap from 'antd/lib/table/hooks/useLazyKVMap'
import useSelection from 'antd/lib/table/hooks/useSelection'
import { normalizeColumns } from './util'
import useSorter, { getSortData } from 'antd/lib/table/hooks/useSorter'
import useFilter, { getFilterData } from 'antd/lib/table/hooks/useFilter'
import usePagination, {
  DEFAULT_PAGE_SIZE,
  getPaginationParam,
} from 'antd/lib/table/hooks/usePagination'
import useTitleColumns from 'antd/lib/table/hooks/useTitleColumns'
import renderExpandIcon from 'antd/lib/table/ExpandIcon'
import { ConfigContext } from 'antd/lib/config-provider/context'

const heightMapper = {
  default: 52,
  middle: 44,
  small: 36.56,
}
const EMPTY_LIST = []
const defaultProps = {
  prefixCls: 'ant-table',
  useFixedHeader: false,
  className: '',
  size: 'default',
  loading: false,
  bordered: false,
  rowKey: 'key',
  showHeader: true,
  onRow: () => ({}),
  rowClassName: () => '',
}
const AntTableAdaptor = (WrappedComponent) => {
  const Adaptor = (props, ref) => {
    const {
      prefixCls: customizePrefixCls,
      className,
      size,
      bordered,
      dropdownPrefixCls: customizeDropdownPrefixCls,
      dataSource,
      rowSelection: selection,
      rowKey,
      rowClassName,
      columns,
      children,
      onChange,
      getPopupContainer,
      loading,
      expandIcon,
      expandable,
      expandedRowRender,
      indentSize,
      childrenColumnName = 'children',
      scroll,
      sortDirections,
      locale,
      showSorterTooltip = true,
    } = props
    const rowSelection = useMemo(
      () => (selection ? { ...selection, columnWidth: selection.columnWidth ?? 32 } : null),
      [selection],
    )
    const pagination = false
    const onChangeRef = useRef(() => {})
    let spinProps
    if (typeof loading === 'boolean') {
      spinProps = {
        spinning: loading,
      }
    } else {
      spinProps = loading
    }
    const { locale: contextLocale = defaultLocale } = React.useContext(ConfigContext)
    const { renderEmpty } = React.useContext(ConfigContext)
    const tableLocale = locale || contextLocale.Table
    const rawData = dataSource || EMPTY_LIST

    const expandType = React.useMemo(
      () => {
        if (rawData.some((item) => item[childrenColumnName])) {
          return 'nest'
        }

        if (expandedRowRender || (expandable && expandable.expandedRowRender)) {
          return 'row'
        }

        return null
      },
      [rawData], // eslint-disable-line
    )

    const internalRefs = {
      body: React.useRef(),
    }
    // ============================ RowKey ============================
    const getRowKey = React.useMemo(() => {
      if (typeof rowKey === 'function') {
        return rowKey
      }
      return (record) => record[rowKey]
    }, [rowKey])

    const [getRecordByKey] = useLazyKVMap(rawData, childrenColumnName, getRowKey)

    // ============================ Events =============================
    const changeEventInfo = {}

    const triggerOnChange = (info, reset = false) => {
      const changeInfo = {
        ...changeEventInfo,
        ...info,
      }

      if (reset) {
        changeEventInfo.resetPagination()

        // Reset event param
        if (changeInfo.pagination.current) {
          changeInfo.pagination.current = 1
        }

        // Trigger pagination events
        if (pagination && pagination.onChange) {
          pagination.onChange(1, changeInfo.pagination.pageSize)
        }
      }

      if (scroll && scroll.scrollToFirstRowOnChange !== false && internalRefs.body.current) {
        scrollTo(0, {
          getContainer: () => internalRefs.body.current,
        })
      }

      if (onChange) {
        onChange(changeInfo.pagination, changeInfo.filters, changeInfo.sorter, {
          currentDataSource: getFilterData(
            getSortData(rawData, changeInfo.sorterStates, childrenColumnName),
            changeInfo.filterStates,
          ),
        })
      }
      onChangeRef.current?.()
    }

    /**
     * Controlled state in `columns` is not a good idea that makes too many code (1000+ line?)
     * to read state out and then put it back to title render.
     * Move these code into `hooks` but still too complex.
     * We should provides Table props like `sorter` & `filter` to handle control in next big version.
     */

    // ============================ Sorter =============================
    const onSorterChange = (sorter, sorterStates) => {
      triggerOnChange(
        {
          sorter,
          sorterStates,
        },
        false,
      )
    }
    const { getPrefixCls } = React.useContext(ConfigContext)
    const prefixCls = getPrefixCls('table', customizePrefixCls)
    const dropdownPrefixCls = getPrefixCls('dropdown', customizeDropdownPrefixCls)

    const [transformSorterColumns, sortStates, sorterTitleProps, getSorters] = useSorter({
      prefixCls,
      columns,
      children,
      onSorterChange,
      sortDirections: sortDirections || ['ascend', 'descend'],
      tableLocale,
      showSorterTooltip,
    })
    const sortedData = React.useMemo(
      () => getSortData(rawData, sortStates, childrenColumnName),
      [childrenColumnName, rawData, sortStates],
    )

    changeEventInfo.sorter = getSorters()
    changeEventInfo.sorterStates = sortStates

    // ============================ Filter ============================
    const onFilterChange = (filters, filterStates) => {
      triggerOnChange(
        {
          filters,
          filterStates,
        },
        true,
      )
    }

    const [transformFilterColumns, filterStates, getFilters] = useFilter({
      prefixCls,
      locale: tableLocale,
      tableLocale,
      dropdownPrefixCls,
      columns,
      children,
      onFilterChange,
      getPopupContainer,
    })
    const mergedData = getFilterData(sortedData, filterStates)

    changeEventInfo.filters = getFilters()
    changeEventInfo.filterStates = filterStates

    // ============================ Column ============================
    const columnTitleProps = React.useMemo(
      () => ({
        ...sorterTitleProps,
      }),
      [sorterTitleProps],
    )
    const [transformTitleColumns] = useTitleColumns(columnTitleProps)

    // ========================== Pagination ==========================
    const onPaginationChange = (current, pageSize) => {
      triggerOnChange({
        pagination: { ...changeEventInfo.pagination, current, pageSize },
      })
    }

    const [mergedPagination, resetPagination] = usePagination(
      mergedData.length,
      pagination,
      onPaginationChange,
    )

    changeEventInfo.pagination =
      pagination === false ? {} : getPaginationParam(pagination, mergedPagination)

    changeEventInfo.resetPagination = resetPagination

    // ============================= Data =============================
    const pageData = React.useMemo(
      () => {
        if (
          pagination === false ||
          !mergedPagination.pageSize ||
          mergedData.length < mergedPagination.total
        ) {
          return mergedData
        }

        const { current = 1, pageSize = DEFAULT_PAGE_SIZE } = mergedPagination
        const currentPageData = mergedData.slice((current - 1) * pageSize, current * pageSize)
        return currentPageData
      },
      /*eslint-disable*/
      [
        !!pagination,
        mergedData,
        mergedPagination && mergedPagination.current,
        mergedPagination && mergedPagination.pageSize,
        mergedPagination && mergedPagination.total,
      ],
      /* eslint-enable */
    )
    // ========================== Selections ==========================
    const [transformSelectionColumns, selectedKeySet] = useSelection(rowSelection, {
      prefixCls,
      data: mergedData,
      pageData,
      getRowKey,
      getRecordByKey,
      expandType,
      locale: tableLocale,
      childrenColumnName,
      getPopupContainer,
    })

    const internalRowClassName = (record, index, indent) => {
      let mergedRowClassName
      if (typeof rowClassName === 'function') {
        mergedRowClassName = classNames(rowClassName(record, index, indent))
      } else {
        mergedRowClassName = classNames(rowClassName)
      }

      return classNames(
        {
          [`${prefixCls}-row-selected`]: selectedKeySet.has(getRowKey(record, index)),
        },
        mergedRowClassName,
      )
    }

    // ========================== Expandable ==========================
    const mergedExpandable = {
      ...expandable,
    }

    // Customize expandable icon
    mergedExpandable.expandIcon =
      mergedExpandable.expandIcon || expandIcon || renderExpandIcon(tableLocale)

    // Adjust expand icon index
    if (expandType === 'nest') {
      mergedExpandable.expandIconColumnIndex = rowSelection ? 1 : 0
    }

    // Indent size
    mergedExpandable.indentSize = mergedExpandable.indentSize || indentSize || 15

    // ============================ Render ============================
    const transformColumns = React.useCallback(
      (innerColumns) => {
        return transformTitleColumns(
          transformSelectionColumns(transformFilterColumns(transformSorterColumns(innerColumns))),
        )
      },
      [
        transformTitleColumns,
        transformSelectionColumns,
        transformFilterColumns,
        transformSorterColumns,
      ],
    )
    const headerHeight = props.headerHeight || heightMapper[size]
    const { showHeader } = props
    const classString = classNames({
      [`${prefixCls}-${size}`]: true,
      [`${prefixCls}-bordered`]: bordered,
      [`${prefixCls}-empty`]: !pageData.length,
      [`${prefixCls}-without-column-header`]: !showHeader,
      'ant-table': true,
      [className]: true,
    })
    const transformedColumns = transformColumns(columns || normalizeColumns(children))
    const fixedColumnCount = useMemo(
      () => transformedColumns.reduce((count, next) => (next.fixed ? count + 1 : count), 0),
      [transformedColumns],
    )
    return (
      <WrappedComponent
        {...props}
        ref={ref}
        dataSource={pageData}
        getRowKey={getRowKey}
        rowClassName={internalRowClassName}
        emptyText={renderEmpty('Table')}
        columns={transformedColumns}
        className={classString}
        headerHeight={headerHeight}
        loading={spinProps}
        getOnChange={(onChange) => (onChangeRef.current = onChange)}
        fixedColumnCount={fixedColumnCount}
        fixedRowCount={0}
        selectedKeySet={selectedKeySet}
      />
    )
  }
  const cmp = forwardRef(Adaptor)
  cmp.propTypes = Table.propTypes
  cmp.defaultProps = defaultProps
  return cmp
}

export default AntTableAdaptor
