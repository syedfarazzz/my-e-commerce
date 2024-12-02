const getPagination = (query) => {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.max(1, parseInt(query.limit) || 20);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    return {
        page,
        limit,
        startIndex,
        endIndex
    };
};

const buildPaginationObject = (page, limit, startIndex, endIndex, totalRecords) => {
    const totalPages = Math.ceil(totalRecords / limit);

    let pagination = {
            page: page,
            limit: limit,
            totalPages: totalPages,
            totalRecords: totalRecords
        };

        if (endIndex < totalRecords) {
            pagination.next = {
                page: page + 1,
                limit: limit,
            };
        } 
        else {
            pagination.next = null;
        }
        
        if (startIndex > 0) {
            pagination.previous = {
                page: page - 1,
                limit: limit,
            };
        } 
        else {
            pagination.previous = null;
        }

    return pagination;
};

module.exports = { getPagination, buildPaginationObject }