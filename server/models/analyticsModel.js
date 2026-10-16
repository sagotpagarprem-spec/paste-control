// Universal Pest Control — Production Marketing Analytics Model (Phase 10)
const { query } = require('../config/database');

const analyticsModel = {
  /**
   * Track Website Pageview with UTMs and Click IDs
   */
  async trackPageView(data) {
    const sessionId = data.sessionId || `sess_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const sql = `
      INSERT INTO web_pageviews (
        session_id, page_url, path, referrer, source, medium, campaign, content, term, gclid, fbclid, user_agent, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      sessionId,
      data.pageUrl || '/',
      data.path || '/',
      data.referrer || null,
      data.source || data.utm_source || 'direct',
      data.medium || data.utm_medium || null,
      data.campaign || data.utm_campaign || null,
      data.content || data.utm_content || null,
      data.term || data.utm_term || null,
      data.gclid || null,
      data.fbclid || null,
      data.userAgent || null,
      data.ipAddress || null
    ];

    await query(sql, params);
    return { tracked: true, sessionId };
  },

  /**
   * Calculate Real Verified Marketing & CRM KPIs (Never Fake Numbers)
   */
  async getOverviewMetrics(filters = {}) {
    const { days, startDate, endDate } = filters || {};
    let leadWhere = '';
    const leadParams = [];
    let bookingWhere = "WHERE status != 'CANCELLED'";
    const bookingParams = [];
    let webWhere = '';
    const webParams = [];

    if (days && !isNaN(days) && Number(days) > 0) {
      const numDays = Number(days);
      leadWhere = ' WHERE created_at >= NOW() - INTERVAL ? DAY';
      leadParams.push(numDays);
      bookingWhere += ' AND created_at >= NOW() - INTERVAL ? DAY';
      bookingParams.push(numDays);
      webWhere = ' WHERE created_at >= NOW() - INTERVAL ? DAY';
      webParams.push(numDays);
    } else if (startDate && endDate) {
      leadWhere = ' WHERE created_at >= ? AND created_at <= ?';
      leadParams.push(startDate, endDate);
      bookingWhere += ' AND created_at >= ? AND created_at <= ?';
      bookingParams.push(startDate, endDate);
      webWhere = ' WHERE created_at >= ? AND created_at <= ?';
      webParams.push(startDate, endDate);
    }

    // 1. CRM Lead counts & Funnel stages
    const [leadStats] = await query(`
      SELECT 
        COUNT(*) as total_leads,
        SUM(CASE WHEN status = 'NEW' OR status = 'NEW_LEAD' THEN 1 ELSE 0 END) as new_leads,
        SUM(CASE WHEN status IN ('QUALIFIED', 'SITE VISIT', 'SITE_VISIT', 'QUOTATION', 'BOOKED', 'COMPLETED') THEN 1 ELSE 0 END) as qualified_leads,
        SUM(CASE WHEN status = 'SITE_VISIT' OR status = 'SITE VISIT' THEN 1 ELSE 0 END) as site_visits,
        SUM(CASE WHEN status = 'QUOTATION' THEN 1 ELSE 0 END) as quotations,
        SUM(CASE WHEN status = 'BOOKED' OR status = 'COMPLETED' THEN 1 ELSE 0 END) as booked_leads,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_leads,
        SUM(CASE WHEN status = 'LOST' THEN 1 ELSE 0 END) as lost_leads
      FROM leads
      ${leadWhere}
    `, leadParams);

    // 2. Booking Revenue
    const [revenueStats] = await query(`
      SELECT 
        COUNT(*) as total_bookings,
        COALESCE(SUM(amount), 0) as total_revenue,
        COALESCE(AVG(amount), 0) as average_order_value
      FROM bookings
      ${bookingWhere}
    `, bookingParams);

    // 3. Ad Spend across Meta campaigns
    const [adStats] = await query(`
      SELECT 
        COALESCE(SUM(spend), 0) as total_ad_spend,
        COALESCE(SUM(impressions), 0) as total_impressions,
        COALESCE(SUM(clicks), 0) as total_clicks,
        COALESCE(SUM(leads), 0) as total_ad_leads
      FROM meta_campaigns
    `);

    // 4. Website Traffic
    const [webStats] = await query(`
      SELECT 
        COUNT(*) as total_pageviews,
        COUNT(DISTINCT session_id) as unique_visitors
      FROM web_pageviews
      ${webWhere}
    `, webParams);

    const totalLeads = Number(leadStats.total_leads || 0);
    const qualifiedLeads = Number(leadStats.qualified_leads || 0);
    const siteVisits = Number(leadStats.site_visits || 0);
    const quotations = Number(leadStats.quotations || 0);
    const bookingsCount = Number(revenueStats.total_bookings || 0);
    const completedCount = Number(leadStats.completed_leads || 0);
    const revenue = Number(revenueStats.total_revenue || 0);
    const adSpend = Number(adStats.total_ad_spend || 0);

    const conversionRate = totalLeads > 0 ? Number(((bookingsCount / totalLeads) * 100).toFixed(1)) : 0;
    const cpl = totalLeads > 0 && adSpend > 0 ? Number((adSpend / totalLeads).toFixed(2)) : 0;
    const cac = bookingsCount > 0 && adSpend > 0 ? Number((adSpend / bookingsCount).toFixed(2)) : 0;
    const roas = adSpend > 0 ? Number((revenue / adSpend).toFixed(2)) : (revenue > 0 ? 'N/A' : '0.0x');

    // 5. Source Breakdown (Attribution)
    const sourceRows = await query(`
      SELECT 
        COALESCE(source, 'Website') as channel,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'BOOKED' OR status = 'COMPLETED' THEN 1 ELSE 0 END) as bookings
      FROM leads
      GROUP BY channel
      ORDER BY count DESC
    `);

    // 6. Campaign Performance
    const campaignRows = await query(`
      SELECT 
        id, name, status, objective,
        COALESCE(daily_budget, lifetime_budget, 0) as budget,
        COALESCE(spend, 0) as spend,
        COALESCE(impressions, 0) as impressions,
        COALESCE(clicks, 0) as clicks,
        COALESCE(leads, 0) as leads,
        COALESCE(cpl, 0) as cpl,
        COALESCE(conversions, 0) as conversions
      FROM meta_campaigns
      ORDER BY id DESC
      LIMIT 10
    `);

    // 7. Service Breakdown
    const serviceRows = await query(`
      SELECT 
        COALESCE(service_name, 'General Pest Control') as service,
        COUNT(*) as count
      FROM leads
      GROUP BY service
      ORDER BY count DESC
      LIMIT 6
    `);

    // 8. Location Breakdown
    const locationRows = await query(`
      SELECT 
        COALESCE(city, 'Pune') as location,
        COUNT(*) as count
      FROM leads
      GROUP BY location
      ORDER BY count DESC
      LIMIT 6
    `);

    // 9. 7-Day Lead Trend
    const trendRows = await query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') as day,
        COUNT(*) as count
      FROM leads
      WHERE created_at >= NOW() - INTERVAL 7 DAY
      GROUP BY day
      ORDER BY day ASC
    `);

    // 10. 7-Day Revenue Trend
    const revTrendRows = await query(`
      SELECT 
        DATE_FORMAT(scheduled_date, '%Y-%m-%d') as day,
        COALESCE(SUM(amount), 0) as revenue,
        COUNT(*) as bookings
      FROM bookings
      WHERE status != 'CANCELLED' AND scheduled_date >= NOW() - INTERVAL 7 DAY
      GROUP BY day
      ORDER BY day ASC
    `);

    return {
      kpis: {
        totalLeads,
        qualifiedLeads,
        siteVisits,
        quotations,
        bookings: bookingsCount,
        completed: completedCount,
        conversionRate: `${conversionRate}%`,
        costPerLead: cpl > 0 ? `₹${cpl.toLocaleString()}` : 'Organic',
        customerAcquisitionCost: cac > 0 ? `₹${cac.toLocaleString()}` : 'Organic',
        revenue: `₹${revenue.toLocaleString()}`,
        roas: typeof roas === 'number' ? `${roas}x` : roas,
        adSpend: `₹${adSpend.toLocaleString()}`,
        pageviews: Number(webStats.total_pageviews || 0),
        visitors: Number(webStats.unique_visitors || 0)
      },
      sources: sourceRows.map(r => ({
        channel: r.channel,
        leads: Number(r.count),
        bookings: Number(r.bookings || 0)
      })),
      campaigns: campaignRows.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        spend: Number(c.spend || 0),
        impressions: Number(c.impressions || 0),
        clicks: Number(c.clicks || 0),
        leads: Number(c.leads || 0),
        cpl: Number(c.cpl || 0),
        conversions: Number(c.conversions || 0)
      })),
      services: serviceRows.map(r => ({
        service: r.service,
        leads: Number(r.count)
      })),
      locations: locationRows.map(r => ({
        location: r.location,
        leads: Number(r.count)
      })),
      trends: trendRows.map(r => ({
        date: r.day,
        leads: Number(r.count)
      })),
      revenueTrends: revTrendRows.map(r => ({
        date: r.day,
        revenue: Number(r.revenue || 0),
        bookings: Number(r.bookings || 0)
      }))
    };
  }
};

module.exports = analyticsModel;
