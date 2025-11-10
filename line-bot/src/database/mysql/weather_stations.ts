import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import userPool from '.';

export const createWeatherStationsTableSql = `
create table
   if not exists \`weather_stations\` (
      \`station_id\` varchar(50) not null comment '氣象站的識別碼',
      \`station_name\` varchar(255) not null comment '氣象站的名稱',
      \`latitude\` decimal(10, 7) not null comment '緯度',
      \`longitude\` decimal(10, 7) not null comment '經度',
      \`elevation_m\` decimal(6, 2) default null comment '海拔高度 (以公尺為單位)',
      \`location_description\` text comment '詳細地理位置描述',
      \`station_type\` enum ('Undefined') default 'undefined' comment '氣象站的類型',
      \`installation_date\` date default null comment '氣象站的安裝日期',
      \`status\` enum ('Active', 'Inactive', 'Maintenance') default 'Maintenance' comment '氣象站的運行狀態',
      \`create_time\` timestamp null default current_timestamp comment '此站點資料建立時間',
      \`update_time\` timestamp null default current_timestamp on update current_timestamp comment '此站點資料更新時間'
   )`.trim();

export interface WeatherStation {
    stationId: string;
    stationName: string;
    latitude: number;
    longitude: number;
    elevationM: number;
    locationDescription?: string | null
    stationType: 'Undefined';
    installationDate?: Date | null;
    status: 'Active' | 'Inactive' | 'Maintenance';
    createdTime?: Date;
    updatedTime?: Date;
}

export async function selectWeatherStationById(stationId: string): Promise<WeatherStation | null> {
    let result: WeatherStation | null = null;
    const sqlStatement = `
select
   *
from
   weather_stations
where
   station_id = ?;`.trim();
    const values: any = [
        stationId
    ];
    const connection: PoolConnection = await userPool.getConnection();
    await connection.beginTransaction();
    try {
        const queryResult: RowDataPacket[] = (await connection.query(sqlStatement, values)).at(0) as RowDataPacket[];
        if (queryResult.length > 0) {
            result = {
                stationId: queryResult[0].station_id,
                stationName: queryResult[0].station_name,
                latitude: queryResult[0].latitude,
                longitude: queryResult[0].longitude,
                elevationM: queryResult[0].elevation_m,
                locationDescription: queryResult[0].location_description,
                stationType: queryResult[0].station_type,
                installationDate: queryResult[0].installation_date,
                status: queryResult[0].status,
                createdTime: queryResult[0].create_time,
                updatedTime: queryResult[0].update_time
            };
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        await connection.release();
    }
    return result;
}