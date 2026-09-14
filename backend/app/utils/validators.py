from flask import request, jsonify

def validate_year_term():
    """
    Validate and return year and term from request args.

    Returns:
        tuple: (year_int, term_str, error_response, error_code)
        - On success: (year, term, None, None)
        - On error: (None, None, jsonify_error, status_code)
    e.g. 
        year, term, error_response, error_code = validate_year_term()
        if error_response:
            return error_response, error_code
    """
    term = request.args.get("term")
    year = request.args.get("year")

    if not term or term.lower() not in {"fall", "spring", "summer"}:
        return None, None, jsonify({"error": "Invalid term"}), 400

    if not year or not year.isdigit():
        return None, None, jsonify({"error": "Invalid year"}), 400

    try:
        year_int = int(year)
        if year_int < 2000 or year_int > 2100:
            raise ValueError
    except ValueError:
        return None, None, jsonify({"error": "Invalid year"}), 400

    return year_int, term.lower(), None, None