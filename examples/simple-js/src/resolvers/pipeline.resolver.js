
import { util } from '@aws-appsync/utils';

export function request(ctx) {
	console.log('starting here')
	return ctx
}

export function response(ctx) {
	const { statusCode, body } = ctx.result;
	// if response is 200, return the response
	if (statusCode === 200) {
		return JSON.parse(body); // this will depend on the response shape of the actual api/datasource
	}
	// if response is not 200, append the response to error block.
	util.appendError(body, statusCode);
}