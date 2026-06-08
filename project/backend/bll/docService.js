/**
 * 文档生成模块
 * 负责 Word/PDF 报告生成，严格匹配《企业安全生产隐患排查报告》模板格式
 *
 * @created 2026-04-12
 * @updated 2026-05-18 — 模板化报告生成
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, HeadingLevel, AlignmentType, BorderStyle, WidthType,
  ShadingType, PageBreak,
} = require('docx')
const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const A4_WIDTH = 11906
const CONTENT_WIDTH = 9360

const FONT = 'SimHei'
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: '999999' }
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }
const CELL_MARGINS = { top: 60, bottom: 60, left: 100, right: 100 }

// ---------------------------------------------------------------------------
// 固定文本
// ---------------------------------------------------------------------------

const 保密声明条款 = [
  '双方保证该保密信息仅用于与合作有关的用途或目的。',
  '双方各自保证对对方所提供的保密信息按本协议约定予以保密，并采取适用于对自己的保密信息同样的保护措施和审慎程度进行保密。',
  '严格执行国家有关法律、法规和有关安全生产文件及标准，采用资料核对和现场查证发现的客观事实为安全生产技术咨询服务的依据，对所检查场所及设施的准确性负责，严格做到客观公正、严谨务实、清廉自律。',
  '任何一方在提供保密信息时，如以书面形式提供，应注明"保密"等相关字样；如以口头或可视形式透露，应在透露前告知接受方为保密信息，并在告知后5日内以书面形式确认，该确认应包含有所透露的信息为保密信息的内容。',
  '双方保证保密信息仅可在各自一方从事该项目研究的负责人和雇员范围内知悉。在双方上述人员知悉该保密信息前，应向其提示保密信息的保密性和应承担的义务，并保证上述人员以书面形式同意接受本协议条款的约束。',
  '经保密信息披露方提出要求，接受方应按照保密信息披露方的指示将含有保密信息的所有文件或其他资料归还给保密信息的披露方，或者按照保密信息披露方的指示予以销毁。项目终止后，保密信息披露方有权向接受方提出书面要求将保密信息资料交还。',
  '接受方应法院或其它法律、行政管理部门要求披露的信息（通过口头提问、询问、要求资料或文件、传唤、民事或刑事调查或其他程序）因而透露保密信息，在该种情况发生时，接受方应立即向披露方发出通知，并作出必要声明。',
  '保密信息披露方提供的保密信息，如涉及侵权第三方，接受方不对此侵权负责，且免于由此带来的索赔。',
  '任何一方未履行本协议所列条款，均为违约，违约方应承担自己的违约行为所造成的损失。',
  '因不可抗拒力产生的相关责任，双方互不承担此期间违约责任，当不可抗拒力解除后，双方应再次共同承担履行各自责任。',
  '此协议一经双方确认签订，任何一方不得变更或修改本协议，国家法律法规规定的除外。',
  '本协议产生的任何争议，双方应先协商解决，若协商不成，任何一方可向所在地人民法院诉讼。',
]

const 服务承诺条款 = [
  '以法律法规为依据，以国家行业主管部门基本规范与行业标准为指南，确保安全生产社会化咨询工作质量，坚持独立、客观、科学、公正的原则，为贵单位提供优质服务，树立良好的声誉并持续改进。',
  '按规定的标准和程序实施安全生产社会化咨询服务，确保咨询服务的有效性和科学性，并具备实施安全生产社会化咨询服务的相适应的高素质的师资专家队伍、技术资源、财务资源及办公条件。',
  '遵守保密规定，未经受审核方的授权决不向第三方透露贵公司的技术、经济方面的机密。',
  '在明确项目的性质，确认安全生产服务的覆盖（适用）的范围和职责后，双方再加以充分沟通，深度研究后做好安全生产社会化服务工作。',
  '我公司可根据企业要求通过增加人力资源等方式，确保咨询工作在企业安排规定的时间内完成，但为保证安全生产社会化服务运行的有效性和实用性并及时解决安全生产服务过程运行中所发现的问题，我公司将定时、定点、定期为贵单位提供咨询服务。',
  '所有资金、物资等以合同约定财务账户为准。',
  '坚持诚信、力求发展、客户满意、社会满意是我们的宗旨，选择佰森安全没有遗憾。安全之路任重道远，佰森伴您一路同行。',
]


// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

const p = (text, opts = {}) => {
  const runs = []
  if (typeof text === 'string') {
    runs.push(new TextRun({ text, size: opts.size || 24, font: opts.font || FONT, bold: !!opts.bold }))
  } else if (Array.isArray(text)) {
    text.forEach((t) => runs.push(t instanceof TextRun ? t : new TextRun({ text: t, size: 24, font: FONT })))
  }
  return new Paragraph({
    children: runs,
    alignment: opts.alignment,
    spacing: opts.spacing || { after: 120 },
    heading: opts.heading,
    ...(opts.extra || {}),
  })
}

const heading1 = (text) => p(text, { size: 32, bold: true, spacing: { before: 300, after: 200 }, heading: HeadingLevel.HEADING_1 })
const heading2 = (text) => p(text, { size: 28, bold: true, spacing: { before: 200, after: 150 }, heading: HeadingLevel.HEADING_2 })

const makeTable = (headers, rows, colWidths) => {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0)
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders: BORDERS,
      width: { size: colWidths[i], type: WidthType.DXA },
      shading: { fill: 'D5E8F0', type: ShadingType.CLEAR },
      margins: CELL_MARGINS,
      children: [p(h, { size: 20, bold: true, alignment: AlignmentType.CENTER })],
    })),
  })
  const dataRows = rows.map((row) => new TableRow({
    children: row.map((cell, i) => new TableCell({
      borders: BORDERS,
      width: { size: colWidths[i], type: WidthType.DXA },
      margins: CELL_MARGINS,
      children: Array.isArray(cell) ? cell : [p(String(cell || ''), { size: 20 })],
    })),
  }))
  return new Table({ width: { size: totalWidth, type: WidthType.DXA }, columnWidths: colWidths, rows: [headerRow, ...dataRows] })
}

/** 解析 AI 结果，提取 items / reference_standards / comprehensive_opinion */
const parseResult = (resultText) => {
  try {
    let text = resultText.trim()
    if (text.startsWith('```json')) text = text.substring(7)
    else if (text.startsWith('```')) text = text.substring(3)
    if (text.endsWith('```')) text = text.substring(0, text.length - 3)
    const data = JSON.parse(text)
    if (data && typeof data === 'object' && (data.hazard_description || Array.isArray(data.items))) {
      return {
        items: Array.isArray(data.items) ? data.items : (data.hazard_description ? [data] : []),
        referenceStandards: Array.isArray(data.reference_standards) ? data.reference_standards : [],
        comprehensiveOpinion: data.comprehensive_opinion || null,
      }
    }
  } catch (e) { /* 忽略 */ }
  return { items: [], referenceStandards: [], comprehensiveOpinion: null }
}

/**
 * 格式化日期为中文格式
 * @param {Date} d
 * @returns {string} 例：二〇二六年五月十八日
 */
const formatDateCN = (d) => {
  const cn = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  const y = String(d.getFullYear())
  const year = y.split('').map((c) => cn[Number(c)]).join('')
  const month = d.getMonth() + 1
  const day = d.getDate()
  const mStr = month <= 10 ? (month === 10 ? '十' : cn[month]) : '十一' + (month === 12 ? '二' : '')
  const dStr = day <= 10 ? (day === 10 ? '十' : cn[day]) : (day < 20 ? '十' + cn[day - 10] : cn[Math.floor(day / 10)] + '十' + (day % 10 ? cn[day % 10] : ''))
  return `${year}年${mStr}月${dStr}日`
}

// ===========================================================================
// 导出
// ===========================================================================

const docService = {
  /**
   * 按模板生成 Word 排查报告
   *
   * @param {object} params
   * @param {object} params.enterprise       — 企业信息（含 name, project_name, inspector_name, region, address）
   * @param {string} params.result           — AI 分析结果 JSON 字符串
   * @param {string[]} params.imagePaths     — 隐患图片本地路径数组
   * @param {string} [params.compilerUnit]   — 编制单位（乙方，管理员填写，留空不显示）
   * @param {string} [params.auditorName]    — 审核人员
   * @returns {Promise<string>} Word 文件相对路径
   */
  async generateTemplateReport({ enterprise, result, imagePaths = [], compilerUnit, auditorName }) {
    const fileName = `report_${Date.now()}.docx`
    const wordPath = path.join('uploads', fileName)
    const fullPath = path.join(__dirname, '..', wordPath)
    const today = new Date()
    const projectTitle = enterprise.project_name
      ? `${enterprise.name || ''} ${enterprise.project_name}`
      : (enterprise.name || '')
    const reportTitle = `${projectTitle}\n安全生产隐患排查报告`

    const structData = parseResult(result)
    const items = structData.items

    const children = []

    // ===== 封面页 =====
    children.push(p('', { spacing: { after: 600 } }))
    children.push(p(reportTitle, { size: 36, bold: true, alignment: AlignmentType.CENTER, spacing: { after: 400 } }))

    // 编制信息表格
    const infoRows = [
      ['编制单位：', compilerUnit || '（待补充）'],
      ['编制人员：', enterprise.inspector_name || '（待补充）'],
      ['审核人员：', auditorName || '（待补充）'],
      ['编制日期：', formatDateCN(today)],
      ['联系电话：', '（待补充）'],
      ['电子邮箱：', '（待补充）'],
    ]
    children.push(makeTable(['项目', '内容'], infoRows, [2500, 6860]))
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ===== 保密公正性声明 =====
    children.push(heading1('保密公正性声明'))
    children.push(p('为保证安全生产技术咨询服务工作的公正性与有效性，经双方协商，共同做以下承诺：'))
    保密声明条款.forEach((clause, i) => {
      children.push(p(`${i + 1}. ${clause}`, { spacing: { after: 100 } }))
    })
    children.push(p(''))
    children.push(p('甲方：                              乙方：'))
    children.push(p('签字（盖章）：　　　　              签字（盖章）：'))
    children.push(p(`年   月   日                        ${formatDateCN(today)}`))
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ===== 服务承诺书 =====
    children.push(heading1('服 务 承 诺 书'))
    children.push(p('为确保我们咨询服务质量到位，最大限度地满足客户的要求，并为客户提供增值的服务。我们对贵单位的服务做出以下郑重承诺：'))
    服务承诺条款.forEach((clause) => {
      children.push(p(`★  ${clause}`, { spacing: { after: 80 } }))
    })
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ===== 目录（手动构建，确保所有阅读器可见） =====
    children.push(heading1('目  录'))
    const tocItems = [
      '一、隐患排查',
      '    （一）隐患排查形式',
      '    （二）检查依据',
      '    （三）现场问题隐患及整改建议措施清单',
      '二、隐患排查综合意见',
      '    （一）安全管理改进方向及建议',
      '    （二）综合建议',
    ]
    tocItems.forEach((line) => {
      children.push(p(line, { size: 24, spacing: { after: 80 } }))
    })
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ===== 一、隐患排查 =====
    children.push(p(reportTitle, { size: 32, bold: true, alignment: AlignmentType.CENTER, spacing: { after: 200 } }))
    children.push(heading1('一、隐患排查'))

    // （一）隐患排查形式
    children.push(heading2('（一）隐患排查形式'))
    children.push(p(`现场工作场所及安全办公区域检查。此次检查覆盖了${projectTitle}所有场所。`))

    // （二）检查依据（由 AI 根据实际隐患动态引用）
    children.push(heading2('（二）检查依据'))
    const refStandards = structData.referenceStandards.length
      ? structData.referenceStandards
      : ['《中华人民共和国安全生产法》']
    refStandards.forEach((law) => {
      children.push(p(`${law}；`))
    })

    // （三）问题清单
    children.push(heading2('（三）现场问题隐患及整改建议措施清单'))
    if (items.length) {
      const colWidths = [1200, 1000, 2500, 800, 2500, 1360]
      const headerCells = ['企业', '地点', '现场存在问题（隐患描述及图片）', '隐患等级', '整改建议', '责任划分']

      const rows = []
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]
        // 图片按索引匹配（顺序与 AI prompt 中的图片清单一致）
        const img = imagePaths[idx] || null

        const cellContent = []
        // 如果有图片，插入
        if (img && fs.existsSync(img)) {
          try {
            cellContent.push(new Paragraph({
              children: [new ImageRun({ type: 'jpeg', data: fs.readFileSync(img), transformation: { width: 200, height: 150 }, altText: { title: '隐患图片', description: '', name: 'img' } })],
              spacing: { after: 60 },
            }))
          } catch (e) { /* 图片加载失败则跳过 */ }
        }
        cellContent.push(p(item.hazard_description || '', { size: 20 }))

        rows.push([
          [p(enterprise.name || '', { size: 20, bold: true })],
          [p(enterprise.project_name || enterprise.region || '', { size: 20 })],
          cellContent,
          [p(item.hazard_level || '一般隐患', { size: 20, alignment: AlignmentType.CENTER })],
          [p(item.suggestion || '', { size: 20 })],
          [p(item.responsibility || '', { size: 20 })],
        ])
      }
      children.push(makeTable(headerCells, rows, colWidths))
    } else {
      children.push(p('（暂无隐患排查项目）'))
    }

    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ===== 二、隐患排查综合意见（由 AI 根据本次隐患动态生成） =====
    children.push(heading1('二、隐患排查综合意见'))

    const opinion = structData.comprehensiveOpinion
    if (opinion && Array.isArray(opinion.improvement_directions) && opinion.improvement_directions.length) {
      children.push(heading2('（一）安全管理改进方向及建议'))
      opinion.improvement_directions.forEach((dir, i) => {
        children.push(p(`${i + 1}. ${dir.title || ''}`, { size: 24, bold: true, spacing: { after: 80 } }))
        children.push(p(dir.content || '', { spacing: { after: 160 } }))
      })

      if (opinion.general_suggestions) {
        children.push(heading2('（二）综合建议'))
        children.push(p(opinion.general_suggestions))
      }
    } else {
      // 降级：AI 未返回综合意见时给出提示
      children.push(p('（AI 未生成综合意见，请重新分析或手动补充。）'))
    }

    // 生成文档
    const doc = new Document({
      styles: {
        default: { document: { run: { font: FONT, size: 24 } } },
        paragraphStyles: [
          { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 32, bold: true, font: FONT },
            paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
          { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 28, bold: true, font: FONT },
            paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 } },
        ],
      },
      sections: [{ properties: { page: { size: { width: A4_WIDTH, height: 16838 } } }, children }],
    })

    const buffer = await Packer.toBuffer(doc)
    fs.writeFileSync(fullPath, buffer)
    return wordPath.replace(/\\/g, '/')
  },

  /**
   * 旧版 Word 生成（保留向后兼容）
   * @deprecated 使用 generateTemplateReport 替代
   */
  async generateWord(prompt, result, imagePath) {
    const fileName = `result_${Date.now()}.docx`
    const wordPath = path.join('uploads', fileName)
    const fullPath = path.join(__dirname, '..', wordPath)

    const children = [
      p('智能隐患排查报告', { size: 32, bold: true, alignment: AlignmentType.CENTER }),
      p(`排查描述：${prompt || '无'}`, { spacing: { after: 200 } }),
    ]

    const imageList = Array.isArray(imagePath) ? imagePath : (imagePath ? [imagePath] : [])
    imageList.forEach((pth, idx) => {
      if (!pth || !fs.existsSync(pth)) return
      try {
        children.push(p(`图片 ${idx + 1}`, { bold: true, size: 22 }))
        children.push(new Paragraph({
          children: [new ImageRun({ type: 'jpeg', data: fs.readFileSync(pth), transformation: { width: 400, height: 300 }, altText: { title: '图片', description: '', name: `img${idx}` } })],
          alignment: AlignmentType.CENTER,
        }))
      } catch (e) { /* skip */ }
    })

    const structData = parseResult(result)
    if (structData) {
      const list = Array.isArray(structData.items) ? structData.items : [structData]
      list.forEach((item, idx) => {
        if (list.length > 1) children.push(p(`隐患分析（${idx + 1}）`, { bold: true, size: 28 }))
        children.push(p('隐患描述：', { bold: true, size: 26 }))
        children.push(p(item.hazard_description || '无'))
        children.push(p('排查依据：', { bold: true, size: 26 }))
        children.push(p(item.basis || '无'))
        children.push(p('整改建议：', { bold: true, size: 26 }))
        children.push(p(item.suggestion || '无'))
      })
    } else {
      (result || '').split('\n').forEach((line) => children.push(p(line)))
    }

    const doc = new Document({ sections: [{ children }] })
    const buffer = await Packer.toBuffer(doc)
    fs.writeFileSync(fullPath, buffer)
    return wordPath.replace(/\\/g, '/')
  },

  /**
   * PDF 生成（保持兼容）
   */
  async generatePDF(prompt, result, imagePath) {
    const fileName = `result_${Date.now()}.pdf`
    const pdfPath = path.join('uploads', fileName)
    const fullPath = path.join(__dirname, '..', pdfPath)

    const pdfDoc = new PDFDocument({ margin: 50 })
    const pdfStream = fs.createWriteStream(fullPath)

    const fontPath = 'C:/Windows/Fonts/simhei.ttf'
    if (fs.existsSync(fontPath)) pdfDoc.font(fontPath)

    pdfDoc.pipe(pdfStream)
    pdfDoc.fontSize(20).text('智能隐患排查报告', { align: 'center' })
    pdfDoc.moveDown()
    pdfDoc.fontSize(12).text(`排查描述：${prompt || '无'}`)
    pdfDoc.moveDown()

    const imageList = Array.isArray(imagePath) ? imagePath : (imagePath ? [imagePath] : [])
    imageList.forEach((pth, idx) => {
      if (!pth || !fs.existsSync(pth)) return
      try {
        pdfDoc.fontSize(12).text(`图片 ${idx + 1}`)
        pdfDoc.image(pth, { fit: [400, 300], align: 'center' })
        pdfDoc.moveDown()
      } catch (e) { /* skip */ }
    })

    const structData = parseResult(result)
    if (structData) {
      const list = Array.isArray(structData.items) ? structData.items : [structData]
      list.forEach((item, idx) => {
        if (list.length > 1) pdfDoc.fontSize(14).text(`隐患分析（${idx + 1}）`)
        pdfDoc.fontSize(13).text('隐患描述：')
        pdfDoc.fontSize(12).text(item.hazard_description || '无').moveDown()
        pdfDoc.fontSize(13).text('排查依据：')
        pdfDoc.fontSize(12).text(item.basis || '无').moveDown()
        pdfDoc.fontSize(13).text('整改建议：')
        pdfDoc.fontSize(12).text(item.suggestion || '无').moveDown()
      })
    } else {
      pdfDoc.fontSize(12).text(result)
    }

    pdfDoc.end()
    return new Promise((resolve) => {
      pdfStream.on('finish', () => resolve(pdfPath.replace(/\\/g, '/')))
      pdfStream.on('error', () => resolve(null))
    })
  },
}

module.exports = docService
